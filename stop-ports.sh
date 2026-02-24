#!/bin/bash
# إيقاف عمليات التطوير على المنافذ الشائعة (لا يوقف خدمات النظام)
PORTS="${1:-3003 8000 8080 5173 4173}"
for port in $PORTS; do
  pid=$(lsof -ti :$port 2>/dev/null)
  if [ -n "$pid" ]; then
    echo "إيقاف المنفذ $port (PID: $pid)"
    kill -9 $pid 2>/dev/null && echo "  ✓ تم" || echo "  ✗ فشل"
  fi
done
echo "انتهى."
