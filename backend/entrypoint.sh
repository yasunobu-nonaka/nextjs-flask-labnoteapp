#!/bin/sh

DB_HOST=${DB_HOST:-db}
DB_PORT=${DB_PORT:-5432}

echo "Waiting for postgres at $DB_HOST:$DB_PORT..."

while ! nc -z $DB_HOST $DB_PORT; do
  sleep 0.5
done

echo "PostgreSQL started"

echo "Applying migrations..."
until flask db upgrade; do
  echo "Migration failed, retrying..."
  sleep 2
done

echo "Starting app..."
exec "$@"