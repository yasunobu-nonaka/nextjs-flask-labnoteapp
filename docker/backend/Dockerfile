FROM python:3.13-slim

RUN apt-get -q -y update && apt-get -y upgrade
RUN apt-get install -y gcc
RUN apt-get install -y netcat-openbsd

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN pip install --upgrade pip
COPY backend/requirements.txt .
RUN pip install -r requirements.txt
COPY backend .

EXPOSE 5000

ENTRYPOINT [ "/app/entrypoint.sh" ]
CMD ["gunicorn", "-b", "0.0.0.0:5000", "--workers", "4", "run:app"]
