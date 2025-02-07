import flask
import openai
import os
import requests  # Add this import
import hashlib
import json
import pathlib
from datetime import datetime
#from dotenv import load_dotenv
from pinecone import Pinecone
import validators
from flask import render_template, request
from openai.embeddings_utils import get_embedding
from helpers import get_matches, fetch_abstract, error

# Load environment variables from .env file
#load_dotenv()

app = flask.Flask(__name__)

# use OpenAI API key from .env
openai.api_key = os.getenv("OPENAI_API_KEY")
if not openai.api_key:
    raise ValueError("OPENAI_API_KEY not found in environment variables")


def get_ollama_embedding(text: str, model: str) -> list:
    """Get embedding from local Ollama server
    
    Args:
        text (str): Text to embed
        model (str): Model name to use
        
    Returns:
        list: Embedding vector
        
    Raises:
        Exception: If embedding fails
    """
    url = "http://localhost:8090/api/embeddings"
    payload = {
        "model": model,
        "prompt": text,
        "stream": False
    }
    
    response = requests.post(url, json=payload)
    response.raise_for_status()
    return response.json().get('embedding', [])

def get_cached_embedding(text: str, model: str) -> list:
    """Get embedding from cache or compute and cache it"""
    print("get_cached_embedding",request.host,model)
    
    cache_dir = f'embeddingjson'
    pathlib.Path(cache_dir).mkdir(exist_ok=True)
    
    # Generate consistent filename from text
    text_hash = hashlib.sha256(text.lower().encode('utf-8')).hexdigest()
    # the file name has to contain the model name, otherwise the cache will be shared between models of different embedding dimensions and semantics    
    cache_file = f"{cache_dir}/{model}-{text_hash}.json"
    
    # Check cache first
    if os.path.exists(cache_file):
        with open(cache_file, 'r') as f:
            data = json.load(f)
            return data['embedding']
    
    # Get new embedding if not cached
    fn = globals()[CONFIG[request.host]["embedding_fn"]]
    embedding = fn(text, model)
        
    # Cache the result
    data = {
        "text": text,
        "embedding": embedding,
        "model": model,
        "timestamp": datetime.now().isoformat()
    }
    with open(cache_file, 'w') as f:
        json.dump(data, f, indent=2)
    
    return embedding

CONFIG = {
    "0.0.0.0:8000": {
        "site_title": "Local test",
        "label_people": "Reviewers",
        "model": "text-embedding-3-small",
        "index": "search-the-arxiv",
        "embedding_fn": "get_embedding",
        "capabilities": ["credit"]
    },
    "tse.local:8083": {
        "site_title": "Semantic TSE Reviewer Search",
        "label_people": "Reviewers",
        "model": "text-embedding-3-small",
        "index": "search-the-arxiv",
        "embedding_fn": "get_embedding",
        "capabilities": ["credit"]
    },
    "se-search.local:8083": {
        "site_title": "Semantic Software Engineering Search",
        "label_people": "Authors",
        "model": "mxbai-embed-large",
        "index": "se-mxbai-embed-large",
        "embedding_fn": "get_ollama_embedding",
        "capabilities": []
    }
}

@app.route("/config")
def config():
    return flask.jsonify(CONFIG[request.host])

@app.route("/")
def home():
    # split request.host in name port
    site_title = request.host.split(":")[0] if ":" in request.host else request.host
    
    return render_template("index.html", site_title=CONFIG[request.host]["site_title"], label_people = CONFIG[request.host]["label_people"])

@app.route("/annotations")
def annotations():
    return open("tse.csv").read()

@app.route("/about")
def about():
    return render_template(f"about-{request.host}.html")

@app.route("/search")
def search():
    query = request.args.get("query")
    # Get model from request, fallback to default
    model = request.args.get("model", CONFIG[request.host]["model"])
    # print("model: ",model,request.host)
    index_name = CONFIG[request.host]["index"]

    # connect to Pinecone
    pc = Pinecone(api_key=os.environ["PINECONE_API_KEY"])
    index = pc.Index(index_name)

    K = 100 # number of matches to request from Pinecone
    
    # special logic for handling arxiv url queries
    # if validators.url(query):
    #     arxiv_id = query.split("/")[-1]
    #     matches = index.fetch([arxiv_id])["vectors"]
    #     if len(matches) == 0:
    #         abstract = fetch_abstract(query)
    #         embed = get_embedding(abstract, MODEL)
    #         return get_matches(index, K, vector=embed, exclude=arxiv_id)
    #     return get_matches(index, K, id=arxiv_id, exclude=arxiv_id)
    
    # reject natural language queries longer than 200 characters
    if len(query) > 1000:
        return error("Sorry! The length of your query cannot be too long.")
    
    # old version for TSE, using openai
    embed = get_cached_embedding(query, model)
    
    # once we have the query embedding, find closest matches in Pinecone
    try:
        return get_matches(index, K, vector=embed)
    except Exception as e:
        print(f"Encountered error when fetching matches from Pinecone: {e}", flush=True)
        return error("Pinecone not responding. Try again in a few minutes.")

@app.route("/robots.txt")
def robots():
    with open("static/robots.txt", "r") as f:
        content = f.read()
    return content

@app.route("/embedding")
def get_embedding_route():
    pc = Pinecone(api_key=os.environ["PINECONE_API_KEY"])
    index = pc.Index(CONFIG[request.host]["index"])
    paper_id = request.args.get("id")
    # print("paper_id",paper_id)
    data = index.fetch([paper_id])
    # print(data)
    return flask.jsonify(data["vectors"][paper_id]["values"])
