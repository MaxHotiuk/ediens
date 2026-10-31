#!/usr/bin/env python3
"""
scripts/generate_architecture_diagram.py
Generates the high-level C4 container and deployment architecture diagram for ēdiens
using the Python 'diagrams' library.
"""

import os
from diagrams import Diagram, Cluster, Edge
from diagrams.onprem.client import Users, Client
from diagrams.programming.framework import React
from diagrams.programming.language import Csharp
from diagrams.onprem.network import Nginx, Internet
from diagrams.onprem.database import PostgreSQL
from diagrams.onprem.inmemory import Redis
from diagrams.onprem.monitoring import Prometheus, Grafana
from diagrams.saas.alerting import Opsgenie

def generate_diagram():
    output_filename = "docs/Ediens_SRS/architecture_diagram"
    
    # Diagram configuration
    graph_attr = {
        "fontsize": "28",
        "bgcolor": "#09090b",
        "fontcolor": "#f4f4f5",
        "pad": "0.5",
        "splines": "spline",
        "nodesep": "0.8",
        "ranksep": "1.0"
    }
    
    node_attr = {
        "fontsize": "12",
        "fontcolor": "#f4f4f5",
        "fontname": "Helvetica"
    }
    
    edge_attr = {
        "color": "#71717a",
        "fontcolor": "#a1a1aa",
        "fontsize": "10"
    }

    with Diagram(
        "ēdiens — System Architecture (C4 Container View)",
        filename=output_filename,
        show=False,
        direction="TB",
        graph_attr=graph_attr,
        node_attr=node_attr,
        edge_attr=edge_attr,
        outformat="png"
    ):
        users = Users("Household Members\n& Meal Preppers\n(Browsers / Mobile PWA)")

        with Cluster("Client & Edge Layer", graph_attr={"bgcolor": "#18181b", "fontcolor": "#e4e4e7"}):
            web_ui = React("React 19 SPA\n(Vite + Tailwind CSS\nElevenLabs Style)")
            proxy = Nginx("Reverse Proxy / Gateway\n(Nginx TLS / Static Host\n/api/* Routing)")

        with Cluster("Application Layer (.NET 10)", graph_attr={"bgcolor": "#18181b", "fontcolor": "#e4e4e7"}):
            api_service = Csharp("ēdiens Web API\n(.NET 10 Minimal APIs\nVertical Slice Architecture\nRFC 9457 ProblemDetails)")
            worker_service = Csharp("Background Worker\n(Transactional Outbox\nSKIP LOCKED Consumer\nFEFO Alert Engine)")

        with Cluster("Data & State Layer", graph_attr={"bgcolor": "#18181b", "fontcolor": "#e4e4e7"}):
            db = PostgreSQL("PostgreSQL 17\n(EF Core 10, xmin RowVersion\nBatches, Meals, Recipes\nOutbox & Idempotency)")
            cache = Redis("Redis 7\n(L2 HybridCache Backplane\nDistributed Lock lock:cook:*\nSliding Window RateLimit)")

        with Cluster("Observability & Telemetry", graph_attr={"bgcolor": "#18181b", "fontcolor": "#e4e4e7"}):
            prom = Prometheus("Prometheus\n(Metrics Scraper\nGolden Signals)")
            graf = Grafana("Grafana\n(Dashboards & Alerts)")

        with Cluster("External Services & Providers", graph_attr={"bgcolor": "#18181b", "fontcolor": "#e4e4e7"}):
            open_food_facts = Internet("Open Food Facts API\n(EAN-13 Product & Macro Lookup\nCircuit Breaker Protected)")
            push_service = Opsgenie("Push Notification Service\n(Web Push / Expiration Alerts)")

        # Ingress flow
        users >> Edge(label="HTTPS / W3C TraceContext", color="#38bdf8") >> web_ui
        web_ui >> Edge(label="REST API Requests", color="#38bdf8") >> proxy
        proxy >> Edge(label="Proxy /api/v1/*", color="#38bdf8") >> api_service

        # Backend application flows
        api_service >> Edge(label="Read / Write (EF Core 10)\nxmin Optimistic Locking", color="#4ade80") >> db
        api_service >> Edge(label="Singleflight HybridCache\nDistributed Lock", color="#f87171") >> cache

        # Background worker flows
        worker_service >> Edge(label="FOR UPDATE SKIP LOCKED\nOutbox Polling & FEFO Queries", color="#4ade80") >> db
        worker_service >> Edge(label="Invalidate Recommendation Cache", color="#f87171") >> cache
        worker_service >> Edge(label="Dispatch Push Alerts\n(T <= 24h Expiration)", color="#fbbf24") >> push_service

        # External integration
        api_service >> Edge(label="Barcode Lookup\nCircuit Breaker + Fallback", color="#fbbf24") >> open_food_facts

        # Telemetry flows
        prom >> Edge(label="Scrape /metrics", color="#a855f7") >> api_service
        prom >> Edge(label="Scrape Worker /metrics", color="#a855f7") >> worker_service
        graf >> Edge(label="Query Metrics", color="#a855f7") >> prom

    print(f"Architecture diagram generated successfully: {output_filename}.png")

if __name__ == "__main__":
    generate_diagram()
