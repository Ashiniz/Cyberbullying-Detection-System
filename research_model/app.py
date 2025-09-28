# app.py
from flask import Flask, request, jsonify
import torch
from transformers import AutoTokenizer
from model import CyberBullyingModel  # Import the model class

# Initialize Flask app
app = Flask(__name__)

# Load the tokenizer and model
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
tokenizer = AutoTokenizer.from_pretrained("tokenizer_folder")  # Path to tokenizer folder
model = CyberBullyingModel(num_severity=5).to(device)
model.load_state_dict(torch.load("final_model.pth", map_location=device))  # Path to model file
model.eval()

@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json()
    text = data.get('text', '')

    # Tokenize input
    inputs = tokenizer(
        text,
        truncation=True,
        padding='max_length',
        max_length=128,
        return_tensors='pt'
    ).to(device)

    # Predict
    with torch.no_grad():
        outputs = model(inputs['input_ids'], inputs['attention_mask'])

    return jsonify({
        "is_bullying": bool(outputs['is_bullying'][0] > 0.5),
        "intent_score": float(outputs['intent_score'][0]),
        "severity": int(torch.argmax(outputs['severity_logits'], dim=-1)[0])
    })

if __name__ == '__main__':
    app.run(debug=True)