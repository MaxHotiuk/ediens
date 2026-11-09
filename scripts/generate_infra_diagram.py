#!/usr/bin/env python3
"""
scripts/generate_infra_diagram.py
Generates the comprehensive cloud / self-hosted infrastructure architecture diagram for ēdiens
using the Python 'diagrams' library, following AWS/Cloud reference architectures.
"""

import os
import sys

def generate_diagram():
    output_filename = "docs/Ediens_SRS/infrastructure_diagram"

    try:
        from diagrams import Diagram, Cluster, Edge
        from diagrams.onprem.client import Users, Client
        from diagrams.onprem.network import Nginx, Internet
        from diagrams.programming.framework import React
        from diagrams.programming.language import Csharp
        from diagrams.onprem.database import PostgreSQL
        from diagrams.onprem.inmemory import Redis
        from diagrams.onprem.monitoring import Prometheus, Grafana
        from diagrams.saas.cdn import Cloudflare
        from diagrams.onprem.vcs import Github
    except ImportError as e:
        print(f"[WARN] Python 'diagrams' library not installed: {e}")
        print("To generate diagram image, install graphviz and diagrams:")
        print("  brew install graphviz (on macOS) or apt-get install -y graphviz (on Linux)")
        print("  pip install diagrams")
        return

    # Diagram configuration
    graph_attr = {
        "fontsize": "28",
        "bgcolor": "#09090b",
        "fontcolor": "#f4f4f5",
        "pad": "0.6",
        "splines": "spline",
        "nodesep": "0.85",
        "ranksep": "1.1"
    }

    node_attr = {
        "fontsize": "11",
        "fontcolor": "#f4f4f5",
        "fontname": "Helvetica-Bold"
    }

    edge_attr = {
        "color": "#71717a",
        "fontcolor": "#a1a1aa",
        "fontsize": "10"
    }

    with Diagram(
        "ēdiens — Cloud & Self-Hosted Infrastructure Topology",
        filename=output_filename,
        show=False,
        direction="TB",
        graph_attr=graph_attr,
        node_attr=node_attr,
        edge_attr=edge_attr,
        outformat="png"
    ):
        users = Users("End Users\n(React 19 SPA / Mobile PWA)\nPublic Internet")
        devops = Client("DevOps / CI Runner\n(Tailscale WireGuard Mesh)")

        with Cluster("Edge & Zero-Trust Security Zone", graph_attr={"bgcolor": "#18181b", "fontcolor": "#38bdf8"}):
            cf_edge = Cloudflare("Cloudflare Edge\n(DNS / WAF / DDoS Guard\nTLS 1.3 / HTTP/3 Termination)")
            cf_tunnel = Cloudflare("Cloudflare Tunnel\n(cloudflared daemon\nZero Open Inbound Ports)")
            tailscale = Internet("Tailscale Mesh VPN\n(WireGuard Overlay\ntag:ci & tag:admin ACLs)")

        with Cluster("Docker Host (Ubuntu 24.04 LTS / Cloud VM)", graph_attr={"bgcolor": "#121214", "fontcolor": "#e4e4e7"}):
            with Cluster("Ingress & DMZ Tier (ediens-public-net)", graph_attr={"bgcolor": "#1f1f23", "fontcolor": "#a1a1aa"}):
                nginx_proxy = Nginx("ediens-web\n(Nginx 1.27 Alpine\nReact 19 Static + /api/* Proxy)")

            with Cluster("Application Compute Tier (ediens-app-net)", graph_attr={"bgcolor": "#1f1f23", "fontcolor": "#4ade80"}):
                api_replicas = Csharp("ediens-api (.NET 10)\n(Kestrel Minimal APIs\nHorizontal Replicas)")
                worker_daemon = Csharp("ediens-worker (.NET 10)\n(Transactional Outbox\nFEFO Expiration Alert Daemon)")

            with Cluster("Stateful Data & Cache Tier (ediens-data-net, internal)", graph_attr={"bgcolor": "#1f1f23", "fontcolor": "#f87171"}):
                postgres_primary = PostgreSQL("ediens-postgres (PG 16)\n(pgdata Volume, WAL,\nxmin Concurrency, ACID)")
                redis_cache = Redis("ediens-redis (Redis 7)\n(redisdata Volume, AOF,\nHybridCache L2 & Redlock)")

            with Cluster("Observability & CI/CD Tier (ediens-monitoring-net)", graph_attr={"bgcolor": "#1f1f23", "fontcolor": "#c084fc"}):
                prometheus = Prometheus("Prometheus Server\n(Scrape 15s, 30d TSDB)")
                grafana = Grafana("Grafana Dashboards\n(Golden Signals & Metrics)")
                github_actions = Github("GitHub Actions Runner\n(tag:ci Deploy Pipeline)")

        # Ingress traffic flows
        users >> Edge(label="HTTPS / TLS 1.3", color="#38bdf8") >> cf_edge
        cf_edge >> Edge(label="Encrypted Cloudflare Tunnel", color="#38bdf8") >> cf_tunnel
        cf_tunnel >> Edge(label="Reverse Proxy to :80", color="#38bdf8") >> nginx_proxy
        nginx_proxy >> Edge(label="Proxy /api/v1/*\n(ediens-app-net)", color="#38bdf8") >> api_replicas

        # Admin & CI/CD deployment flows
        devops >> Edge(label="WireGuard Tunnel (:41641/udp)", color="#fbbf24") >> tailscale
        tailscale >> Edge(label="Secure SSH / Docker Socket", color="#fbbf24") >> github_actions
        github_actions >> Edge(label="docker compose up -d", color="#fbbf24") >> api_replicas

        # App to Data flows
        api_replicas >> Edge(label="EF Core (TCP/5432)\nConnection Pool", color="#4ade80") >> postgres_primary
        api_replicas >> Edge(label="Distributed Lock & L2 Cache\n(TCP/6379)", color="#f87171") >> redis_cache

        # Worker flows
        worker_daemon >> Edge(label="Outbox SKIP LOCKED\nFEFO Scan (TCP/5432)", color="#4ade80") >> postgres_primary
        worker_daemon >> Edge(label="Invalidate Recommendation\nCache (TCP/6379)", color="#f87171") >> redis_cache

        # Observability scraping flows
        prometheus >> Edge(label="Scrape /metrics", color="#c084fc") >> api_replicas
        prometheus >> Edge(label="Scrape Worker /metrics", color="#c084fc") >> worker_daemon
        grafana >> Edge(label="PromQL Queries", color="#c084fc") >> prometheus

    print(f"[OK] Infrastructure diagram generated successfully: {output_filename}.png")

if __name__ == "__main__":
    generate_diagram()
