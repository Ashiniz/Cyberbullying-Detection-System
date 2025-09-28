# model.py
import torch
import torch.nn as nn
from transformers import AutoModel

class CyberBullyingModel(nn.Module):
    def __init__(self, base_model='cardiffnlp/twitter-roberta-base', num_severity=5):
        super(CyberBullyingModel, self).__init__()
        self.roberta = AutoModel.from_pretrained(base_model)
        self.dropout = nn.Dropout(0.3)
        self.bullying_head = nn.Linear(768, 1)  # Binary classification for bullying
        self.intent_head = nn.Linear(768, 1)    # Regression for harmful intent score
        self.severity_head = nn.Linear(768, num_severity)  # Multi-class classification for severity

    def forward(self, input_ids, attention_mask):
        outputs = self.roberta(input_ids=input_ids, attention_mask=attention_mask)
        pooled_output = self.dropout(outputs.pooler_output)
        bullying = torch.sigmoid(self.bullying_head(pooled_output)).squeeze(-1)
        intent_score = torch.sigmoid(self.intent_head(pooled_output)) * 100
        severity_logits = self.severity_head(pooled_output)
        return {
            'is_bullying': bullying,
            'intent_score': intent_score,
            'severity_logits': severity_logits
        }