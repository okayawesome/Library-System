"""Endpoints anyone can call, before signing in."""

from fastapi import APIRouter

from library_system.api.dependencies import SessionDep
from library_system.api.schemas import BranchOut
from library_system.services import catalogue

router = APIRouter(tags=["public"])


@router.get("/branches")
def list_branches(session: SessionDep) -> list[BranchOut]:
    """Every library in the network (the sign-up form needs these)."""
    return [
        BranchOut.model_validate(branch)
        for branch in catalogue.list_branches(session)
    ]
