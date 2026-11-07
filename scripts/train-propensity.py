"""Train the lead propensity model on data/smb_leads.csv and export coefficients for the TypeScript scorer.
Run: python scripts/train-propensity.py   (needs pandas, scikit-learn)"""
import json, numpy as np, pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import StratifiedKFold, cross_val_predict

CATS = ["lead_source", "segment", "city_tier", "preferred_language", "annual_turnover_band", "has_gstin", "has_udyam", "current_internet", "current_provider", "contact_role"]
d = pd.read_csv("data/smb_leads.csv")
y = (d.outcome == "Activated").astype(int)
num = pd.DataFrame({
    "log_spend": np.log1p(d.monthly_telecom_spend_inr),
    "log_staff": np.log1p(d.employee_count),
    "sites": d.num_sites.astype(float),
    "interests": d.products_of_interest.fillna("").str.count(";") + 1,
})
means = num.mean()
X = pd.concat([pd.get_dummies(d[CATS].astype(str), prefix_sep="=").astype(float), num - means], axis=1)
model = LogisticRegression(max_iter=3000, C=0.5)
p = cross_val_predict(model, X, y, cv=StratifiedKFold(5, shuffle=True, random_state=0), method="predict_proba")[:, 1]
auc = roc_auc_score(y, p)
order = np.argsort(-p); top30 = y.values[order[: int(len(y) * 0.3)]].sum() / y.sum()
cuts = np.quantile(p, [0.7, 0.4])
model.fit(X, y)
out = {
    "trainedOn": "smb_leads.csv (5,000 leads, Apr-Jun 2026)",
    "auc": round(float(auc), 3),
    "top30Capture": round(float(top30), 3),
    "intercept": float(model.intercept_[0]),
    "categorical": {c: float(w) for c, w in zip(X.columns, model.coef_[0]) if "=" in c},
    "numeric": {c: {"weight": float(w), "mean": float(means[c])} for c, w in zip(X.columns, model.coef_[0]) if "=" not in c},
    "bands": {"high": float(cuts[0]), "medium": float(cuts[1])},
    "medianBundleBySegment": d[d.outcome == "Activated"].groupby("segment").monthly_bundle_value_inr.median().to_dict(),
}
json.dump(out, open("src/domain/leads/propensity-model.json", "w"), indent=1)
print(f"AUC {auc:.3f}, top 30% capture {top30:.1%}, bands {cuts}")
