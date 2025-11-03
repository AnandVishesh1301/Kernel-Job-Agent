from __future__ import annotations

from typing import Any, Dict, Optional
from urllib.parse import urlparse

from langgraph.graph import StateGraph


class AgentState(dict):
    # dict-backed state
    pass


def node_plan(state: AgentState) -> AgentState:
    state["plan"] = "navigate_and_fill"
    return state


def node_route(state: AgentState) -> AgentState:
    url = state.get("url", "")
    netloc = urlparse(url).netloc
    state["domain"] = netloc
    if "greenhouse.io" in netloc:
        state["strategy"] = "greenhouse"
    elif "lever.co" in netloc:
        state["strategy"] = "lever"
    elif "workday" in netloc or "myworkdayjobs.com" in netloc:
        state["strategy"] = "workday"
    else:
        state["strategy"] = "generic"
    return state


def build_graph() -> StateGraph:
    graph = StateGraph(AgentState)
    graph.add_node("plan", node_plan)
    graph.add_node("route", node_route)
    # apply_via_kernel and finalize/handle_error will be plugged by the runner with closures
    return graph


