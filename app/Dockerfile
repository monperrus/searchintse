FROM python:3.10.6-slim
EXPOSE 8000

COPY app.py .
COPY helpers.py .
COPY paper.py .
COPY static static/
COPY templates templates/
COPY requirements.txt .
COPY *.csv .

RUN pip3 install --upgrade pip
RUN pip3 install -r requirements.txt

# we bind on all ports in the docker container but only on localhost on the host 127.0.0.1:8000:8000
CMD gunicorn --bind 0.0.0.0:8000 app:app
