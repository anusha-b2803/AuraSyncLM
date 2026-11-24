"""
routers/auth.py
─────────────────
Local user authentication endpoints for AuraSync LM.
Provides secure password hashing (PBKDF2-HMAC-SHA256) and user state management.
"""

import os
import json
import uuid
import hashlib
import secrets
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException
from main import DATA_DIR

router = APIRouter(tags=["Authentication"])

USERS_FILE = os.path.join(DATA_DIR, "users.json")


def load_users():
    if not os.path.exists(USERS_FILE):
        return {}
    try:
        with open(USERS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_users(users):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, indent=2)


class UserAuth(BaseModel):
    email: str
    password: str
    fullName: Optional[str] = None


def hash_password(password: str, salt: str = None) -> str:
    if salt is None:
        salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000).hex()
    return f"{salt}:{hashed}"


def verify_password(password: str, hashed_password: str) -> bool:
    if ":" not in hashed_password:
        return password == hashed_password
    salt, _ = hashed_password.split(":", 1)
    return hash_password(password, salt) == hashed_password


@router.post("/register")
def register(auth: UserAuth):
    users = load_users()
    if auth.email in users:
        raise HTTPException(status_code=400, detail="Identity already registered.")
    user_id = str(uuid.uuid4())
    users[auth.email] = {
        "id": user_id,
        "email": auth.email,
        "password": hash_password(auth.password),
        "fullName": auth.fullName or auth.email.split('@')[0]
    }
    save_users(users)
    return {
        "status": "success",
        "user": {
            "id": user_id,
            "email": auth.email,
            "fullName": users[auth.email]["fullName"]
        }
    }


@router.post("/login")
def login(auth: UserAuth):
    users = load_users()
    user = users.get(auth.email)
    if not user or not verify_password(auth.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials.")
    return {
        "status": "success",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "fullName": user["fullName"]
        }
    }
