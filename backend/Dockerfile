FROM python:3.11-slim

WORKDIR /app

# Install runtime deps explicitly (no packaging assumptions)
RUN pip install --no-cache-dir -U pip && \
    pip install --no-cache-dir \
      fastapi \
      "uvicorn[standard]" \
      pydantic \
      numpy \
      scipy \
      pandas \
      yfinance \
      python-dotenv \
      httpx

# Copy source
COPY src /app/src

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
