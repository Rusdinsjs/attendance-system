"""
Face Embedding Extraction Service
Uses face_recognition library (dlib wrapper) to extract 128-dimensional face embeddings.
"""

import os
import json
import face_recognition
import numpy as np
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok"})

@app.route('/extract-embeddings', methods=['POST'])
def extract_embeddings():
    """
    Extract face embeddings from image files.
    
    Request JSON:
    {
        "image_paths": ["/path/to/image1.jpg", "/path/to/image2.jpg", ...]
    }
    
    Response JSON:
    {
        "success": true,
        "embeddings": [[0.1, 0.2, ...], [0.3, 0.4, ...], ...],
        "count": 5
    }
    """
    try:
        data = request.get_json()
        image_paths = data.get('image_paths', [])
        
        if not image_paths:
            return jsonify({"success": False, "error": "No image paths provided"}), 400
        
        all_embeddings = []
        
        for path in image_paths:
            # Handle paths - Docker mounts ./uploads to /app/uploads
            # Input paths from Go are like: /uploads/faces/{uuid}/file.jpg
            if path.startswith('/uploads'):
                path = '/app' + path  # Convert to Docker container path: /app/uploads/...
            elif path.startswith('uploads'):
                path = '/app/' + path
            
            if not os.path.exists(path):
                print(f"Warning: File not found: {path}")
                continue
            
            # Load image
            image = face_recognition.load_image_file(path)
            
            # Extract face encodings (embeddings)
            face_encodings = face_recognition.face_encodings(image)
            
            if len(face_encodings) > 0:
                # Take the first face found
                embedding = face_encodings[0].tolist()
                all_embeddings.append(embedding)
            else:
                print(f"Warning: No face found in {path}")
        
        if len(all_embeddings) == 0:
            return jsonify({
                "success": False, 
                "error": "No faces detected in any of the provided images"
            }), 400
        
        return jsonify({
            "success": True,
            "embeddings": all_embeddings,
            "count": len(all_embeddings)
        })
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/compare-faces', methods=['POST'])
def compare_faces():
    """
    Compare a face embedding against stored embeddings.
    
    Request JSON:
    {
        "probe_embedding": [0.1, 0.2, ...],
        "gallery_embeddings": [[0.1, 0.2, ...], [0.3, 0.4, ...], ...],
        "threshold": 0.6
    }
    
    Response JSON:
    {
        "success": true,
        "match": true,
        "distance": 0.45,
        "similarity": 0.55
    }
    """
    try:
        data = request.get_json()
        probe = np.array(data.get('probe_embedding', []))
        gallery = [np.array(e) for e in data.get('gallery_embeddings', [])]
        threshold = data.get('threshold', 0.6)
        
        if len(probe) == 0 or len(gallery) == 0:
            return jsonify({"success": False, "error": "Missing embeddings"}), 400
        
        # Calculate distances using face_recognition's compare_faces
        distances = face_recognition.face_distance(gallery, probe)
        
        min_distance = float(np.min(distances))
        is_match = min_distance <= threshold
        similarity = 1 - min_distance  # Convert distance to similarity
        
        return jsonify({
            "success": True,
            "match": is_match,
            "distance": min_distance,
            "similarity": similarity
        })
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=True)
