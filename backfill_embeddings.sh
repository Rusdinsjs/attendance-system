#!/bin/bash
# Script to backfill face embeddings for existing approved users

FACE_SERVICE_URL="http://localhost:5001"
DB_CMD="docker compose -f /var/www/attendance/docker-compose.yml exec -T postgres psql -U attendance -d attendance_db"

echo "🔄 Backfilling face embeddings..."

# Get users with approved status but no embeddings
users=$(ssh root@148.230.98.192 "$DB_CMD -t -c \"SELECT id FROM users WHERE face_verification_status = 'approved' AND face_embeddings IS NULL;\"")

for user_id in $users; do
    user_id=$(echo "$user_id" | tr -d ' ')
    if [ -z "$user_id" ]; then continue; fi
    
    echo "Processing user: $user_id"
    
    # Get face photos for this user
    photos=$(ssh root@148.230.98.192 "ls /var/www/attendance/uploads/faces/$user_id/ 2>/dev/null | head -5")
    
    if [ -z "$photos" ]; then
        echo "  No photos found, skipping"
        continue
    fi
    
    # Build image paths JSON array
    paths=""
    for photo in $photos; do
        paths="$paths\"/uploads/faces/$user_id/$photo\","
    done
    paths="[${paths%,}]"  # Remove trailing comma
    
    echo "  Extracting embeddings for: $paths"
    
    # Call face service
    result=$(ssh root@148.230.98.192 "curl -s -X POST $FACE_SERVICE_URL/extract-embeddings -H 'Content-Type: application/json' -d '{\"image_paths\": $paths}'")
    
    success=$(echo "$result" | jq -r '.success')
    if [ "$success" = "true" ]; then
        embeddings=$(echo "$result" | jq -c '.embeddings')
        
        # Update database
        ssh root@148.230.98.192 "$DB_CMD -c \"UPDATE users SET face_embeddings = '$embeddings'::jsonb WHERE id = '$user_id';\""
        echo "  ✅ Updated embeddings for $user_id"
    else
        echo "  ❌ Failed: $result"
    fi
done

echo "✅ Backfill complete!"
