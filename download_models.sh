#!/bin/bash
BASE_URL="https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights"
TARGET_DIR="web/public/models"

files=(
  "face_landmark_68_model-weights_manifest.json"
  "face_landmark_68_model-shard1"
  "face_recognition_model-weights_manifest.json"
  "face_recognition_model-shard1"
  "face_recognition_model-shard2"
  "ssd_mobilenetv1_model-weights_manifest.json"
  "ssd_mobilenetv1_model-shard1"
  "ssd_mobilenetv1_model-shard2"
)

echo "Downloading models to $TARGET_DIR..."

for file in "${files[@]}"; do
  if [ -f "$TARGET_DIR/$file" ]; then
    echo "Skipping $file (already exists)"
  else
    echo "Downloading $file..."
    curl -L "$BASE_URL/$file" -o "$TARGET_DIR/$file"
  fi
done

echo "Download complete!"
