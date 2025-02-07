import flask
import openai
import os
import requests  # Add this import
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

MODEL = "text-embedding-3-small"

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

CONFIG = {
    "tse.local:8083": {
        "site_title": "Semantic TSE Reviewer Search",
        "label_people": "Reviewers",
        "model": "text-embedding-3-small",
        "embedding_fn": "get_embedding",
        "capabilites": ["credit"]
    },
    "se-search.local:8083": {
        "site_title": "Semantic Software Engineering Search",
        "label_people": "Authors",
        "model": "mxbai-embed-large",
        "embedding_fn": "get_ollama_embedding",
        "capabilites": ["credit"]
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
    model = request.args.get("model", "mxbai-embed-large")
    print("model: ",model,request.host)
    index_name = "search-the-arxiv"

    # if host == se-search
    if request.host.startswith("se-search"):
        index_name = "se-"+model

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
    print(request.host)
    if request.host == "localhost" or request.host.startswith("0.0.0.0")  or request.host.startswith("127.0.0.1") or request.host.startswith("tse.local"):
        embed = get_embedding(query, MODEL)
    elif request.host.startswith("se-search"):
        embed = get_ollama_embedding(query, model)
    
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
