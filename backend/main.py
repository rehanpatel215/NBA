from fastapi import FastAPI
from pydantic import BaseModel
from sqlalchemy import Column, Integer, String, Boolean, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

app = FastAPI()

# Database setup
DATABASE_URL = "sqlite:///./achievements.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
Base = declarative_base()
SessionLocal = sessionmaker(bind=engine)

# Table
class Achievement(Base):
    __tablename__ = "achievements"

    id = Column(Integer, primary_key=True)
    name = Column(String)
    category = Column(String)
    level = Column(String)
    activity = Column(String)
    date = Column(String)
    institution = Column(String)
    has_certificate = Column(Boolean)

Base.metadata.create_all(bind=engine)

# Request model
class AchievementCreate(BaseModel):
    name: str
    category: str
    level: str
    activity: str
    date: str
    institution: str
    has_certificate: bool

@app.post("/submit-achievement")
def submit_achievement(data: AchievementCreate):
    db = SessionLocal()
    entry = Achievement(**data.dict())
    db.add(entry)
    db.commit()
    db.close()
    return {"message": "Achievement stored successfully"}