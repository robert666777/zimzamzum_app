from sqlmodel import create_engine, Session
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os

load_dotenv()

db_host = os.getenv('DB_HOST', '127.0.0.1')
db_port = int(os.getenv('DB_PORT', 5432))
db_username = os.getenv('DB_USERNAME', 'postgres')
db_password = os.getenv('DB_PASSWORD', '')
db_database = os.getenv('DB_DATABASE', 'neuralagent')

DATABASE_URL = f"postgresql+psycopg2://{db_username}:{db_password}@{db_host}:{db_port}/{db_database}"

engine = create_engine(
    DATABASE_URL, 
    echo=True,
    connect_args={
        "host": db_host,
        "port": db_port,
        "user": db_username,
        "password": db_password,
        "dbname": db_database,
        "client_encoding": "utf8"
    }
)

SessionLocal = sessionmaker(class_=Session, bind=engine, autocommit=False, autoflush=False)


def get_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
