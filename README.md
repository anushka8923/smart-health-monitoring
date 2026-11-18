# Smart Community Health Monitoring and Early Warning System

A web-based health monitoring and early warning system designed to monitor community health, assess vector-borne disease risks, and support early detection in rural Northeast India.

## Features

- Community health monitoring
- Disease risk assessment
- Early warning and alert system
- Role-based dashboards for Admin, ASHA workers, and PHC users
- Weather-based monitoring support
- SMS, WhatsApp, and email notification integration

## Tech Stack

**Frontend**
- React.js
- Vite
- JavaScript
- CSS

**Backend**
- Python
- FastAPI
- SQLAlchemy

**Database**
- PostgreSQL

## Project Structure

```text
smart-health-monitoring/
├── backend/
│   ├── app/
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   ├── public/
│   ├── src/
│   ├── package.json
│   └── README.md
│
└── README.md
```

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/anushka8923/smart-health-monitoring.git
cd smart-health-monitoring
```

### 2. Backend Setup

```bash
cd backend
python -m venv venv
```

Activate the virtual environment on Windows:

```bash
venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create a `.env` file using `.env.example` and configure the required environment variables.

Start the backend:

```bash
python -m uvicorn app.main:app --reload
```

### 3. Frontend Setup

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

Configure the required database, API, WhatsApp, SMS, and email credentials in your local `.env` files.

**Never commit actual API keys, passwords, or secret tokens to GitHub.**

## Purpose

The project aims to support community-level health monitoring and early warning for vector-borne diseases, particularly in rural areas of Northeast India.