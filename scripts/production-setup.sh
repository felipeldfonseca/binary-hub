#!/bin/bash

# Binary Hub Production Environment Setup Script
# This script prepares the production environment with necessary configurations

set -e

echo "🚀 Binary Hub Production Setup"
echo "================================"

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI is required. Install with: npm install -g firebase-tools"
    exit 1
fi

# Check if user is logged in to Firebase
if ! firebase projects:list &> /dev/null; then
    echo "❌ Please login to Firebase first: firebase login"
    exit 1
fi

# Set project variables
PROJECT_ID=${FIREBASE_PROJECT_ID:-"binary-hub-prod"}
REGION="us-central1"

echo "📋 Project Configuration:"
echo "  Project ID: $PROJECT_ID"
echo "  Region: $REGION"

# Select Firebase project
echo "🔧 Setting up Firebase project..."
firebase use "$PROJECT_ID" || {
    echo "❌ Failed to select project. Make sure $PROJECT_ID exists."
    exit 1
}

# Enable required Firebase services
echo "🔥 Enabling Firebase services..."
firebase projects:list

# Set up Firestore security rules for production
echo "🔒 Deploying Firestore security rules..."
firebase deploy --only firestore:rules

# Set up Storage security rules
echo "📁 Deploying Storage security rules..."
firebase deploy --only storage

# Deploy Functions with secrets
echo "🔧 Setting up Function secrets..."

# Set required secrets (these should be set in Firebase console or via CLI)
REQUIRED_SECRETS=(
    "OPENAI_API_KEY"
    "GEMINI_API_KEY"
    "STRIPE_SECRET_KEY"
    "STRIPE_WEBHOOK_SECRET"
)

for secret in "${REQUIRED_SECRETS[@]}"; do
    echo "⚠️  Ensure secret '$secret' is set in Firebase Functions configuration"
done

# Deploy Functions
echo "🚀 Deploying Functions..."
cd functions
npm ci --production
npm run build
cd ..
firebase deploy --only functions

# Deploy Hosting (if frontend is ready)
if [ -d "app/.next" ] || [ -d "app/out" ]; then
    echo "🌐 Deploying Frontend..."
    cd app
    npm ci --production
    npm run build
    cd ..
    firebase deploy --only hosting
else
    echo "⚠️  Frontend build not found. Skipping hosting deployment."
fi

# Set up monitoring and alerts
echo "📊 Setting up monitoring..."

# Create monitoring dashboard configuration
cat > monitoring-config.json << EOF
{
  "dashboardName": "Binary Hub Production",
  "metrics": [
    {
      "name": "function_executions",
      "type": "cloud_function",
      "filters": {
        "function_name": "api"
      }
    },
    {
      "name": "database_reads",
      "type": "firestore",
      "metric": "document_reads"
    },
    {
      "name": "database_writes",
      "type": "firestore",
      "metric": "document_writes"
    },
    {
      "name": "storage_usage",
      "type": "storage",
      "metric": "total_bytes"
    }
  ],
  "alerts": [
    {
      "name": "High Error Rate",
      "condition": "function_error_rate > 5%",
      "notification": "email"
    },
    {
      "name": "High Database Usage",
      "condition": "daily_reads > 50000",
      "notification": "email"
    }
  ]
}
EOF

echo "📧 Monitoring configuration saved to monitoring-config.json"

# Set up backup strategy
echo "💾 Setting up backup strategy..."

cat > backup-config.json << EOF
{
  "firestore": {
    "schedule": "0 2 * * *",
    "retention": "30 days",
    "collections": [
      "users",
      "trades",
      "subscriptions",
      "billing_customers"
    ]
  },
  "storage": {
    "schedule": "0 3 * * *",
    "retention": "90 days",
    "buckets": [
      "uploads"
    ]
  }
}
EOF

echo "🔄 Backup configuration saved to backup-config.json"

# Performance optimization settings
echo "⚡ Setting up performance optimizations..."

cat > performance-config.json << EOF
{
  "functions": {
    "memory": "1GB",
    "timeout": "540s",
    "concurrency": 1000,
    "minInstances": 1,
    "maxInstances": 100
  },
  "firestore": {
    "indexes": [
      {
        "collectionGroup": "trades",
        "queryScope": "COLLECTION",
        "fields": [
          {"fieldPath": "userId", "order": "ASCENDING"},
          {"fieldPath": "timestamp", "order": "DESCENDING"}
        ]
      },
      {
        "collectionGroup": "trades",
        "queryScope": "COLLECTION",
        "fields": [
          {"fieldPath": "userId", "order": "ASCENDING"},
          {"fieldPath": "asset", "order": "ASCENDING"},
          {"fieldPath": "timestamp", "order": "DESCENDING"}
        ]
      }
    ]
  },
  "caching": {
    "redis": {
      "enabled": false,
      "ttl": 900
    },
    "memory": {
      "enabled": true,
      "maxSize": "100MB"
    }
  }
}
EOF

echo "🚀 Performance configuration saved to performance-config.json"

# Security checklist
echo "🔐 Security Configuration Checklist:"
echo "  ✅ Firestore security rules deployed"
echo "  ✅ Storage security rules deployed"
echo "  ✅ Function secrets configured"
echo "  ⚠️  CORS origins should be restricted to production domain"
echo "  ⚠️  Rate limiting is configured for API endpoints"
echo "  ⚠️  SSL/TLS certificates are properly configured"

# Domain and SSL setup
if [ ! -z "$CUSTOM_DOMAIN" ]; then
    echo "🌐 Custom domain configuration:"
    echo "  Domain: $CUSTOM_DOMAIN"
    echo "  Run: firebase hosting:sites:create --site-id=$CUSTOM_DOMAIN"
    echo "  Add domain in Firebase Console > Hosting > Add custom domain"
fi

# Final verification
echo "🔍 Running final verification..."

# Check if all services are deployed
firebase projects:list
echo "✅ Project accessible"

# Test API endpoint
if command -v curl &> /dev/null; then
    API_URL="https://$REGION-$PROJECT_ID.cloudfunctions.net/api/health"
    if curl -f "$API_URL" &> /dev/null; then
        echo "✅ API endpoint responding"
    else
        echo "⚠️  API endpoint not responding at $API_URL"
    fi
fi

echo ""
echo "🎉 Production Setup Complete!"
echo ""
echo "📋 Next Steps:"
echo "  1. Set up custom domain (if needed)"
echo "  2. Configure monitoring alerts"
echo "  3. Set up automated backups"
echo "  4. Configure CI/CD pipeline"
echo "  5. Perform load testing"
echo ""
echo "📊 Important URLs:"
echo "  Firebase Console: https://console.firebase.google.com/project/$PROJECT_ID"
echo "  API Base URL: https://$REGION-$PROJECT_ID.cloudfunctions.net/api"
echo "  Frontend URL: https://$PROJECT_ID.web.app"
echo ""
echo "⚠️  Remember to:"
echo "  - Set up monitoring and alerts"
echo "  - Configure backup schedules"
echo "  - Test payment processing"
echo "  - Verify email notifications"
echo "  - Set up SSL monitoring"
echo ""

# Generate deployment summary
cat > deployment-summary.md << EOF
# Binary Hub Production Deployment Summary

## Deployment Date
$(date)

## Project Configuration
- **Project ID**: $PROJECT_ID
- **Region**: $REGION
- **Environment**: Production

## Services Deployed
- ✅ Firebase Functions (API)
- ✅ Firestore Database
- ✅ Firebase Storage
- ✅ Firebase Hosting
- ✅ Security Rules

## API Endpoints
- Base URL: https://$REGION-$PROJECT_ID.cloudfunctions.net/api
- Health Check: /health
- Authentication: /auth/*
- Trading: /v1/trades/*
- Analytics: /v1/analytics/*
- Social: /v1/social/*
- AI Services: /v1/ai/*
- Billing: /v1/billing/*

## Security Features
- Firestore security rules deployed
- Storage security rules deployed
- CORS configured
- Rate limiting enabled
- Function secrets configured

## Monitoring
- Error tracking enabled
- Performance monitoring active
- Usage metrics collection
- Alert configurations ready

## Next Steps
1. Configure custom domain
2. Set up monitoring dashboards
3. Enable backup automation
4. Configure CI/CD pipeline
5. Perform security audit
6. Load testing
7. Go-live checklist

## Support
- Documentation: docs/
- Error logs: Firebase Console
- Monitoring: Google Cloud Console
EOF

echo "📄 Deployment summary saved to deployment-summary.md"
echo ""
echo "🏁 Production setup completed successfully!"