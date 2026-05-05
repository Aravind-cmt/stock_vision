import pandas as pd
import numpy as np
import warnings
warnings.filterwarnings('ignore')
from xgboost import XGBRegressor
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import r2_score, mean_absolute_error
from sklearn.metrics import accuracy_score, confusion_matrix, classification_report

DIRECTION_THRESHOLD_PCT = 0.002

df = pd.read_csv(r"C:\Users\ARAVIND\OneDrive\Documents\MLproject\data preprocessing\Nifty_50_Preprocess.csv")

df['Date'] = pd.to_datetime(df['Date'])
df = df.sort_values('Date').reset_index(drop=True)





df = df.dropna()

rolling_mean=df['next_close'].shift(1).rolling(90).mean()
rolling_std=df['next_close'].shift(1).rolling(90).std().replace(0, 1e-6)

def zscore_to_price(pred_norm, val_index):
    
    mean = rolling_mean.loc[val_index]
    std  = rolling_std.loc[val_index]
    return pred_norm * std.values + mean.values


selected_features = [
    'Change_%', 'ATR',
    'grade_no', 'zscore_vol',
    'volatility', 'RN', 'price_spike',
    'SMI','RSI',
    'trend', 'momentum'
]

X = df[selected_features]
y = df['zscore_norm_close']


tscv_split = TimeSeriesSplit(n_splits=5)

all_splits = list(tscv_split.split(X))

train_index, test_index = all_splits[-1]
X_train, X_test = X.iloc[train_index], X.iloc[test_index]
y_train, y_test = y.iloc[train_index], y.iloc[test_index]


model = XGBRegressor(
    n_estimators=500,
    max_depth=5,
    learning_rate=0.03,
    subsample=0.9,
    colsample_bytree=0.9,
    gamma=0.1,
    min_child_weight=3,
    reg_alpha=0.1,
    reg_lambda=1.5,
    random_state=42
)

model.fit(X_train, y_train)


import matplotlib.pyplot as plt
import numpy as np

plt.rcParams['font.family'] = 'Times New Roman'
plt.rcParams['font.size'] = 12



y_pred_train = model.predict(X_train)
y_pred_test  = model.predict(X_test)

print("\n NORMALIZED (Z-Score) ")
print("Train Normalized R2:",  r2_score(y_train, y_pred_train))
print("Test  Normalized R2:",  r2_score(y_test,  y_pred_test))
print("Train MAE:", mean_absolute_error(y_train, y_pred_train))
print("Test  MAE:", mean_absolute_error(y_test,  y_pred_test))

xgb_test_index = X_test.index
xgb_train_index = X_train.index

spike_flag = df['price_spike'].loc[xgb_test_index]
spike_flag_train = df['price_spike'].loc[xgb_train_index]

y_pred_train_adj = np.where(
    spike_flag_train == 1,
    0.5 * y_pred_train,
    y_pred_train
)

y_pred_adj = np.where(
    spike_flag == 1,
    0.5 * y_pred_test,
    y_pred_test
)

raw_price = zscore_to_price(y_pred_adj, xgb_test_index)
pred_price_xgb = pd.Series(raw_price, index=xgb_test_index)

raw_price_train = zscore_to_price(y_pred_train_adj, xgb_train_index)
pred_price_xgb_train = pd.Series(raw_price_train, index=xgb_train_index)

actual_price        = df['next_close'].loc[xgb_test_index].dropna()
pred_price_xgb_valid = pred_price_xgb.loc[actual_price.index]

actual_price_train = df['next_close'].loc[xgb_train_index].dropna()
pred_price_xgb_train_valid = pred_price_xgb_train.loc[actual_price_train.index]

print("\n===== PRICE (Z-Score) =====")
print("Price R2:",  r2_score(actual_price, pred_price_xgb_valid))
print("MAE:", mean_absolute_error(actual_price, pred_price_xgb_valid))

prev_close_test = df['Close'].loc[actual_price.index]
threshold_test = prev_close_test * DIRECTION_THRESHOLD_PCT
y_true_signal = ((actual_price - prev_close_test) > threshold_test).astype(int)
y_pred_signal = ((pred_price_xgb_valid - prev_close_test) > threshold_test).astype(int)

prev_close_train = df['Close'].loc[actual_price_train.index]
threshold_train = prev_close_train * DIRECTION_THRESHOLD_PCT
y_true_signal_train = ((actual_price_train - prev_close_train) > threshold_train).astype(int)
y_pred_signal_train = ((pred_price_xgb_train_valid - prev_close_train) > threshold_train).astype(int)

print("\n SIGNAL (0.2% THRESHOLD)")
print("Train Accuracy:", accuracy_score(y_true_signal_train, y_pred_signal_train))
print("Test  Accuracy:", accuracy_score(y_true_signal, y_pred_signal))
print("Confusion Matrix:\n",      confusion_matrix(y_true_signal, y_pred_signal))
print("Classification Report:\n", classification_report(y_true_signal, y_pred_signal))
pred_price_xgb = pred_price_xgb_valid

y_test_xgb      = y_test
y_pred_test_xgb = y_pred_test


tscv = TimeSeriesSplit(n_splits=5)

xgb_norm_r2  = []
xgb_norm_mae = []

print("\n K-FOLD NORMALIZED ")

for fold, (train_idx, val_idx) in enumerate(tscv.split(X), 1):
    X_tr, X_val = X.iloc[train_idx], X.iloc[val_idx]
    y_tr, y_val = y.iloc[train_idx], y.iloc[val_idx]

    model.fit(X_tr, y_tr)

    y_pred = model.predict(X_val)

    r2  = r2_score(y_val, y_pred)
    mae = mean_absolute_error(y_val, y_pred)

    xgb_norm_r2.append(r2)
    xgb_norm_mae.append(mae)

    print(f"Fold {fold} → R2: {r2:.4f}, MAE: {mae:.4f}")

print("\nMean R2:",  np.mean(xgb_norm_r2))
print("Mean MAE:", np.mean(xgb_norm_mae))

xgb_price_r2  = []
xgb_price_mae = []

print("\n K-FOLD PRICE (Z-Score) ")

for fold, (train_idx, val_idx) in enumerate(tscv.split(X), 1):
    X_tr, X_val = X.iloc[train_idx], X.iloc[val_idx]
    y_tr, y_val = y.iloc[train_idx], y.iloc[val_idx]

    model.fit(X_tr, y_tr)

    y_pred    = model.predict(X_val)
    val_index = X_val.index

    spike_flag = df['price_spike'].loc[val_index]

    y_pred_adj = np.where(
        spike_flag == 1,
        0.5 * y_pred,
        y_pred
    )

    raw_price    = zscore_to_price(y_pred_adj, val_index)
    pred_price   = pd.Series(raw_price, index=val_index)

    actual_price      = df['next_close'].loc[val_index].dropna()
    pred_price_valid  = pred_price.loc[actual_price.index]

    r2  = r2_score(actual_price, pred_price_valid)
    mae = mean_absolute_error(actual_price, pred_price_valid)

    xgb_price_r2.append(r2)
    xgb_price_mae.append(mae)

    print(f"Fold {fold} → R2: {r2:.4f}, MAE: {mae:.2f}")

print("\nMean PRICE R2:",  np.mean(xgb_price_r2))
print("Mean PRICE MAE:", np.mean(xgb_price_mae))
print("Std R2:",          np.std(xgb_price_r2))

from sklearn.neural_network import MLPRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import r2_score, mean_absolute_error, accuracy_score, confusion_matrix, classification_report
from sklearn.model_selection import TimeSeriesSplit
import numpy as np

X_train = X.iloc[train_index]
X_test  = X.iloc[test_index]

y_train = y.iloc[train_index]
y_test  = y.iloc[test_index]

scaler    = StandardScaler()
X_train_s = scaler.fit_transform(X_train) 
X_test_s  = scaler.transform(X_test)

ann_test_index = X_test.index

ann = MLPRegressor(
    hidden_layer_sizes=(64, 32),
    activation='relu',
    solver='adam',
    learning_rate_init=0.001,
    max_iter=500,
    random_state=42
)

ann.fit(X_train_s, y_train)

y_pred_train = ann.predict(X_train_s)
y_pred_test  = ann.predict(X_test_s)

print("\n ANN NORMALIZED (Z-Score) ")
print("Train R2:",  r2_score(y_train, y_pred_train))
print("Test  R2:",  r2_score(y_test,  y_pred_test))
print("Train MAE:", mean_absolute_error(y_train, y_pred_train))
print("Test  MAE:", mean_absolute_error(y_test,  y_pred_test))

y_true_signal_train = (y_train > 0).astype(int)
y_pred_signal_train = (y_pred_train > 0).astype(int)

y_true_signal = (y_test > 0).astype(int)
y_pred_signal = (y_pred_test > 0).astype(int)

print("\nANN SIGNAL ")
print("Train Accuracy:", accuracy_score(y_true_signal_train, y_pred_signal_train))
print("Test  Accuracy:", accuracy_score(y_true_signal, y_pred_signal))
print("Confusion Matrix:\n",      confusion_matrix(y_true_signal, y_pred_signal))
print("Classification Report:\n", classification_report(y_true_signal, y_pred_signal))

spike_flag = df['price_spike'].loc[ann_test_index]

y_pred_adj = np.where(
    spike_flag == 1,
    0.5 * y_pred_test,
    y_pred_test
)

raw_price        = zscore_to_price(y_pred_adj, ann_test_index)
pred_price       = pd.Series(raw_price, index=ann_test_index)

actual_price      = df['next_close'].loc[ann_test_index].dropna()
pred_price_valid  = pred_price.loc[actual_price.index]

print("\n ANN PRICE (Z-Score) ")
print("R2:",  r2_score(actual_price, pred_price_valid))
print("MAE:", mean_absolute_error(actual_price, pred_price_valid))

y_test_s        = y_test
y_pred_test_ann = y_pred_test
pred_price_ann  = pred_price_valid

tscv = TimeSeriesSplit(n_splits=5)

ann_norm_r2  = []
ann_norm_mae = []

print("\n ANN K-FOLD NORMALIZED ")

for fold, (train_idx, val_idx) in enumerate(tscv.split(X), 1):

    scaler = StandardScaler()

    X_tr  = scaler.fit_transform(X.iloc[train_idx])
    X_val = scaler.transform(X.iloc[val_idx])

    y_tr  = y.iloc[train_idx]
    y_val = y.iloc[val_idx]

    ann.fit(X_tr, y_tr)

    y_pred = ann.predict(X_val)

    r2  = r2_score(y_val, y_pred)
    mae = mean_absolute_error(y_val, y_pred)

    ann_norm_r2.append(r2)
    ann_norm_mae.append(mae)

    print(f"Fold {fold} → R2: {r2:.4f}, MAE: {mae:.4f}")

print("\nMean R2:",  np.mean(ann_norm_r2))
print("Mean MAE:", np.mean(ann_norm_mae))

ann_price_r2  = []
ann_price_mae = []

print("\n ANN K-FOLD PRICE (Z-Score) ")

for fold, (train_idx, val_idx) in enumerate(tscv.split(X), 1):

    scaler = StandardScaler()

    X_tr  = scaler.fit_transform(X.iloc[train_idx])
    X_val = scaler.transform(X.iloc[val_idx])

    y_tr  = y.iloc[train_idx]
    y_val = y.iloc[val_idx]

    ann.fit(X_tr, y_tr)

    y_pred    = ann.predict(X_val)
    val_index = X.iloc[val_idx].index

    spike_flag = df['price_spike'].loc[val_index]

    y_pred_adj = np.where(
        spike_flag == 1,
        0.5 * y_pred,
        y_pred
    )

    raw_price    = zscore_to_price(y_pred_adj, val_index)
    pred_price   = pd.Series(raw_price, index=val_index)

    actual_price = df['next_close'].loc[val_index].dropna()
    pred_price   = pred_price.loc[actual_price.index]

    r2  = r2_score(actual_price, pred_price)
    mae = mean_absolute_error(actual_price, pred_price)

    ann_price_r2.append(r2)
    ann_price_mae.append(mae)

    print(f"Fold {fold} → R2: {r2:.4f}, MAE: {mae:.2f}")

print("\nMean PRICE R2:",  np.mean(ann_price_r2))
print("Mean PRICE MAE:", np.mean(ann_price_mae))
print("Std R2:",          np.std(ann_price_r2))

from sklearn.linear_model import LinearRegression

lr = LinearRegression()

lr.fit(X_train, y_train)

y_pred_train_lr = lr.predict(X_train)
y_pred_test_lr  = lr.predict(X_test)

print("\n LR NORMALIZED (Z-Score) ")
print("Train R2:",  r2_score(y_train, y_pred_train_lr))
print("Test  R2:",  r2_score(y_test,  y_pred_test_lr))
print("Train MAE:", mean_absolute_error(y_train, y_pred_train_lr))
print("Test  MAE:", mean_absolute_error(y_test,  y_pred_test_lr))

y_true_signal_train = (y_train > 0).astype(int)
y_pred_signal_train = (y_pred_train_lr > 0).astype(int)

y_true_signal = (y_test > 0).astype(int)
y_pred_signal = (y_pred_test_lr > 0).astype(int)

print("\n LR SIGNAL ")
print("Train Accuracy:", accuracy_score(y_true_signal_train, y_pred_signal_train))
print("Test  Accuracy:", accuracy_score(y_true_signal, y_pred_signal))
print("Confusion Matrix:\n",      confusion_matrix(y_true_signal, y_pred_signal))
print("Classification Report:\n", classification_report(y_true_signal, y_pred_signal))

lr_test_index = X_test.index

spike_flag = df['price_spike'].loc[lr_test_index]

y_pred_adj = np.where(
    spike_flag == 1,
    0.5 * y_pred_test_lr,
    y_pred_test_lr
)

raw_price         = zscore_to_price(y_pred_adj, lr_test_index)
pred_price_lr     = pd.Series(raw_price, index=lr_test_index)
actual_price      = df['next_close'].loc[lr_test_index].dropna()
pred_price_lr_valid = pred_price_lr.loc[actual_price.index]

print("\n LR PRICE (Z-Score) ")
print("R2:",  r2_score(actual_price, pred_price_lr_valid))
print("MAE:", mean_absolute_error(actual_price, pred_price_lr_valid))
pred_price_lr = pred_price_lr_valid


tscv = TimeSeriesSplit(n_splits=5)

lr_norm_r2  = []
lr_norm_mae = []

print("\n LR K-FOLD NORMALIZED ")

for fold, (train_idx, val_idx) in enumerate(tscv.split(X), 1):
    X_tr, X_val = X.iloc[train_idx], X.iloc[val_idx]
    y_tr, y_val = y.iloc[train_idx], y.iloc[val_idx]

    lr.fit(X_tr, y_tr)

    y_pred = lr.predict(X_val)

    r2  = r2_score(y_val, y_pred)
    mae = mean_absolute_error(y_val, y_pred)

    lr_norm_r2.append(r2)
    lr_norm_mae.append(mae)

    print(f"Fold {fold} → R2: {r2:.4f}, MAE: {mae:.4f}")

print("\nMean R2:",  np.mean(lr_norm_r2))
print("Mean MAE:", np.mean(lr_norm_mae))


lr_price_r2  = []
lr_price_mae = []

print("\nLR K-FOLD PRICE (Z-Score) ")

for fold, (train_idx, val_idx) in enumerate(tscv.split(X), 1):
    X_tr, X_val = X.iloc[train_idx], X.iloc[val_idx]
    y_tr, y_val = y.iloc[train_idx], y.iloc[val_idx]

    lr.fit(X_tr, y_tr)

    y_pred    = lr.predict(X_val)
    val_index = X_val.index

    spike_flag = df['price_spike'].loc[val_index]

    y_pred_adj = np.where(
        spike_flag == 1,
        0.5 * y_pred,
        y_pred
    )

    raw_price    = zscore_to_price(y_pred_adj, val_index)
    pred_price   = pd.Series(raw_price, index=val_index)
    actual_price = df['next_close'].loc[val_index].dropna()

    pred_price_valid = pred_price.loc[actual_price.index]

    r2  = r2_score(actual_price, pred_price_valid)
    mae = mean_absolute_error(actual_price, pred_price_valid)

    lr_price_r2.append(r2)
    lr_price_mae.append(mae)

    print(f"Fold {fold} → R2: {r2:.4f}, MAE: {mae:.2f}")

print("\nMean PRICE R2:",  np.mean(lr_price_r2))
print("Mean PRICE MAE:", np.mean(lr_price_mae))
print("Std R2:",          np.std(lr_price_r2))



from sklearn.svm import SVR
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import r2_score, mean_absolute_error, accuracy_score, confusion_matrix, classification_report
from sklearn.model_selection import TimeSeriesSplit
import numpy as np


X_train = X.iloc[train_index]
X_test  = X.iloc[test_index]

y_train = y.iloc[train_index]
y_test  = y.iloc[test_index]


scaler    = StandardScaler()
X_train_s = scaler.fit_transform(X_train)
X_test_s  = scaler.transform(X_test)

svm_test_index = X_test.index


svm = SVR(kernel='rbf', C=10, gamma='scale', epsilon=0.01, max_iter=500)


svm.fit(X_train_s, y_train)


y_pred_train = svm.predict(X_train_s)
y_pred_test  = svm.predict(X_test_s)


print("\n SVM NORMALIZED (Z-Score) ")
print("Train R2:",  r2_score(y_train, y_pred_train))
print("Test  R2:",  r2_score(y_test,  y_pred_test))
print("Train MAE:", mean_absolute_error(y_train, y_pred_train))
print("Test  MAE:", mean_absolute_error(y_test,  y_pred_test))


y_true_signal_train = (y_train > 0).astype(int)
y_pred_signal_train = (y_pred_train > 0).astype(int)

y_true_signal = (y_test > 0).astype(int)
y_pred_signal = (y_pred_test > 0).astype(int)

print("\nSVM SIGNAL ")
print("Train Accuracy:", accuracy_score(y_true_signal_train, y_pred_signal_train))
print("Test  Accuracy:", accuracy_score(y_true_signal, y_pred_signal))
print("Confusion Matrix:\n",      confusion_matrix(y_true_signal, y_pred_signal))
print("Classification Report:\n", classification_report(y_true_signal, y_pred_signal))


spike_flag = df['price_spike'].loc[svm_test_index]

y_pred_adj = np.where(
    spike_flag == 1,
    0.5 * y_pred_test,
    y_pred_test
)

raw_price        = zscore_to_price(y_pred_adj, svm_test_index)
pred_price       = pd.Series(raw_price, index=svm_test_index)

actual_price     = df['next_close'].loc[svm_test_index].dropna()
pred_price_valid = pred_price.loc[actual_price.index]

print("\n SVM PRICE (Z-Score) ")
print("R2:",  r2_score(actual_price, pred_price_valid))
print("MAE:", mean_absolute_error(actual_price, pred_price_valid))

y_test_svm      = y_test
y_pred_test_svm = y_pred_test
pred_price_svm  = pred_price_valid


tscv = TimeSeriesSplit(n_splits=5)

svm_norm_r2  = []
svm_norm_mae = []

print("\n SVM K-FOLD NORMALIZED ")

for fold, (train_idx, val_idx) in enumerate(tscv.split(X), 1):

    scaler = StandardScaler()

    X_tr  = scaler.fit_transform(X.iloc[train_idx])
    X_val = scaler.transform(X.iloc[val_idx])

    y_tr  = y.iloc[train_idx]
    y_val = y.iloc[val_idx]

    svm.fit(X_tr, y_tr)

    y_pred = svm.predict(X_val)

    r2  = r2_score(y_val, y_pred)
    mae = mean_absolute_error(y_val, y_pred)

    svm_norm_r2.append(r2)
    svm_norm_mae.append(mae)

    print(f"Fold {fold} → R2: {r2:.4f}, MAE: {mae:.4f}")

print("\nMean R2:",  np.mean(svm_norm_r2))
print("Mean MAE:", np.mean(svm_norm_mae))


svm_price_r2  = []
svm_price_mae = []

print("\n SVM K-FOLD PRICE (Z-Score) ")

for fold, (train_idx, val_idx) in enumerate(tscv.split(X), 1):

    scaler = StandardScaler()

    X_tr  = scaler.fit_transform(X.iloc[train_idx])
    X_val = scaler.transform(X.iloc[val_idx])

    y_tr  = y.iloc[train_idx]
    y_val = y.iloc[val_idx]

    svm.fit(X_tr, y_tr)

    y_pred    = svm.predict(X_val)
    val_index = X.iloc[val_idx].index

    spike_flag = df['price_spike'].loc[val_index]

    y_pred_adj = np.where(
        spike_flag == 1,
        0.5 * y_pred,
        y_pred
    )

    raw_price    = zscore_to_price(y_pred_adj, val_index)
    pred_price   = pd.Series(raw_price, index=val_index)

    actual_price = df['next_close'].loc[val_index].dropna()
    pred_price   = pred_price.loc[actual_price.index]

    r2  = r2_score(actual_price, pred_price)
    mae = mean_absolute_error(actual_price, pred_price)

    svm_price_r2.append(r2)
    svm_price_mae.append(mae)

    print(f"Fold {fold} → R2: {r2:.4f}, MAE: {mae:.2f}")

print("\nMean PRICE R2:",  np.mean(svm_price_r2))
print("Mean PRICE MAE:", np.mean(svm_price_mae))
print("Std R2:",          np.std(svm_price_r2))



from sklearn.ensemble import RandomForestRegressor

rf = RandomForestRegressor(
    n_estimators=500,
    max_depth=5,
    min_samples_split=5,
    random_state=42,
    n_jobs=-1
)

rf.fit(X_train, y_train)

y_pred_train_rf = rf.predict(X_train)
y_pred_test_rf  = rf.predict(X_test)

print("\n RF NORMALIZED (Z-Score): ")
print("Train R2:",  r2_score(y_train, y_pred_train_rf))
print("Test  R2:",  r2_score(y_test,  y_pred_test_rf))
print("Train MAE:", mean_absolute_error(y_train, y_pred_train_rf))
print("Test  MAE:", mean_absolute_error(y_test,  y_pred_test_rf))

y_true_signal_train = (y_train > 0).astype(int)
y_pred_signal_train = (y_pred_train_rf > 0).astype(int)

y_true_signal = (y_test > 0).astype(int)
y_pred_signal = (y_pred_test_rf > 0).astype(int)

print("\n RF SIGNAL :")
print("Train Accuracy:", accuracy_score(y_true_signal_train, y_pred_signal_train))
print("Test  Accuracy:", accuracy_score(y_true_signal, y_pred_signal))
print("Confusion Matrix:\n",      confusion_matrix(y_true_signal, y_pred_signal))
print("Classification Report:\n", classification_report(y_true_signal, y_pred_signal))

rf_test_index = X_test.index

spike_flag = df['price_spike'].loc[rf_test_index]

y_pred_adj = np.where(
    spike_flag == 1,
    0.5 * y_pred_test_rf,
    y_pred_test_rf
)

raw_price          = zscore_to_price(y_pred_adj, rf_test_index)
pred_price_rf      = pd.Series(raw_price, index=rf_test_index)
actual_price       = df['next_close'].loc[rf_test_index].dropna()
pred_price_rf_valid = pred_price_rf.loc[actual_price.index]

print("\n RF PRICE:")
print("R2:",  r2_score(actual_price, pred_price_rf_valid))
print("MAE:", mean_absolute_error(actual_price, pred_price_rf_valid))
pred_price_rf = pred_price_rf_valid


tscv = TimeSeriesSplit(n_splits=5)

rf_norm_r2  = []
rf_norm_mae = []

print("\nRF K-FOLD NORMALIZED :")

for fold, (train_idx, val_idx) in enumerate(tscv.split(X), 1):
    X_tr, X_val = X.iloc[train_idx], X.iloc[val_idx]
    y_tr, y_val = y.iloc[train_idx], y.iloc[val_idx]

    rf.fit(X_tr, y_tr)

    y_pred = rf.predict(X_val)

    r2  = r2_score(y_val, y_pred)
    mae = mean_absolute_error(y_val, y_pred)

    rf_norm_r2.append(r2)
    rf_norm_mae.append(mae)

    print(f"Fold {fold} → R2: {r2:.4f}, MAE: {mae:.4f}")

print("\nMean R2:",  np.mean(rf_norm_r2))
print("Mean MAE:", np.mean(rf_norm_mae))


rf_price_r2  = []
rf_price_mae = []

print("\n RF K-FOLD PRICE (Z-Score) :")

for fold, (train_idx, val_idx) in enumerate(tscv.split(X), 1):
    X_tr, X_val = X.iloc[train_idx], X.iloc[val_idx]
    y_tr, y_val = y.iloc[train_idx], y.iloc[val_idx]

    rf.fit(X_tr, y_tr)

    y_pred    = rf.predict(X_val)
    val_index = X_val.index

    spike_flag = df['price_spike'].loc[val_index]

    y_pred_adj = np.where(
        spike_flag == 1,
        0.5 * y_pred,
        y_pred
    )

    raw_price    = zscore_to_price(y_pred_adj, val_index)
    pred_price   = pd.Series(raw_price, index=val_index)
    actual_price = df['next_close'].loc[val_index].dropna()
    pred_price   = pred_price.loc[actual_price.index]

    r2  = r2_score(actual_price, pred_price)
    mae = mean_absolute_error(actual_price, pred_price)

    rf_price_r2.append(r2)
    rf_price_mae.append(mae)

    print(f"Fold {fold} → R2: {r2:.4f}, MAE: {mae:.2f}")

print("\nMean PRICE R2:",  np.mean(rf_price_r2))
print("Mean PRICE MAE:", np.mean(rf_price_mae))
print("Std R2:",          np.std(rf_price_r2))




print("\n K-FOLD SIGNAL COMPUTATION ")

xgb_signal_acc = []
ann_signal_acc = []
lr_signal_acc  = []
svm_signal_acc = []
rf_signal_acc  = []

for fold, (train_idx, val_idx) in enumerate(tscv.split(X), 1):
    X_tr, X_val = X.iloc[train_idx], X.iloc[val_idx]
    y_tr, y_val = y.iloc[train_idx], y.iloc[val_idx]

    scaler_ann = StandardScaler()
    X_tr_scaled  = scaler_ann.fit_transform(X_tr)
    X_val_scaled = scaler_ann.transform(X_val)

    scaler_svm = StandardScaler()
    X_tr_svm  = scaler_svm.fit_transform(X_tr)
    X_val_svm = scaler_svm.transform(X_val)

    y_true_sig = (y_val > 0).astype(int)

    model.fit(X_tr, y_tr)
    y_pred_xgb = model.predict(X_val)
    xgb_signal_acc.append(accuracy_score(y_true_sig, (y_pred_xgb > 0).astype(int)))


    ann.fit(X_tr_scaled, y_tr)
    y_pred_ann = ann.predict(X_val_scaled)
    ann_signal_acc.append(accuracy_score(y_true_sig, (y_pred_ann > 0).astype(int)))


    lr.fit(X_tr, y_tr)
    y_pred_lr = lr.predict(X_val)
    lr_signal_acc.append(accuracy_score(y_true_sig, (y_pred_lr > 0).astype(int)))


    svm.fit(X_tr_svm, y_tr)
    y_pred_svm = svm.predict(X_val_svm)
    svm_signal_acc.append(accuracy_score(y_true_sig, (y_pred_svm > 0).astype(int)))


    rf.fit(X_tr, y_tr)
    y_pred_rf = rf.predict(X_val)
    rf_signal_acc.append(accuracy_score(y_true_sig, (y_pred_rf > 0).astype(int)))

print(f"Mean Signal Accuracy XGBoost:     {np.mean(xgb_signal_acc):.4f}")
print(f"Mean Signal Accuracy ANN:         {np.mean(ann_signal_acc):.4f}")
print(f"Mean Signal Accuracy LR:          {np.mean(lr_signal_acc):.4f}")
print(f"Mean Signal Accuracy SVM:         {np.mean(svm_signal_acc):.4f}")
print(f"Mean Signal Accuracy RF:          {np.mean(rf_signal_acc):.4f}")



r2_df = pd.DataFrame({
    "Model": ["XGBoost", "ANN", "Linear", "SVM", "RandomForest"],
    "R2": [
        r2_score(y_test_xgb,  y_pred_test_xgb),
        r2_score(y_test_s,    y_pred_test_ann),
        r2_score(y_test,      y_pred_test_lr),
        r2_score(y_test_svm,  y_pred_test_svm),
        r2_score(y_test,      y_pred_test_rf)
    ]
})

print(r2_df)

plt.figure(figsize=(10, 6))

bars = plt.bar(r2_df["Model"], r2_df["R2"])

for bar in bars:
    yval = bar.get_height()
    plt.text(bar.get_x() + bar.get_width() / 2, yval, f'{yval:.4f}', ha='center', va='bottom')

plt.title("R2 Comparison (Z-Score Prediction)")
plt.xlabel("Models")
plt.ylabel("R2 Score")
plt.grid(axis='y')
plt.show()


error_df = pd.DataFrame({
    "XGBoost":     np.abs(y_test_xgb.values - y_pred_test_xgb),
    "ANN":         np.abs(y_test_s.values   - y_pred_test_ann),
    "Linear":      np.abs(y_test.values     - y_pred_test_lr),
    "SVM":         np.abs(y_test_svm.values - y_pred_test_svm),
    "RandomForest":np.abs(y_test.values     - y_pred_test_rf)
})

plt.figure(figsize=(10, 5))
ax = error_df.mean().plot(kind='bar')

for p in ax.patches:
    ax.annotate(f'{p.get_height():.4f}',
                (p.get_x() + p.get_width() / 2., p.get_height()),
                ha='center', va='bottom')

plt.title("Average Prediction Error (Z-Score Norm)")
plt.ylabel("MAE")
plt.grid()
plt.show()


shared_test_index = xgb_test_index

actual_price_shared   = df['next_close'].loc[shared_test_index].dropna()
pred_price_xgb_shared = pred_price_xgb.loc[actual_price_shared.index]
pred_price_ann_shared = pred_price_ann.loc[actual_price_shared.index]
pred_price_lr_shared  = pred_price_lr.loc[actual_price_shared.index]
pred_price_svm_shared = pred_price_svm.loc[actual_price_shared.index]
pred_price_rf_shared  = pred_price_rf.loc[actual_price_shared.index]

results = {
    "Model": ["XGBoost", "ANN", "Linear", "SVM", "RandomForest"],

    "Norm_R2": [
        r2_score(y_test_xgb,  y_pred_test_xgb),
        r2_score(y_test_s,    y_pred_test_ann),
        r2_score(y_test,      y_pred_test_lr),
        r2_score(y_test_svm,  y_pred_test_svm),
        r2_score(y_test,      y_pred_test_rf)
    ],

    "Norm_MAE": [
        mean_absolute_error(y_test_xgb,  y_pred_test_xgb),
        mean_absolute_error(y_test_s,    y_pred_test_ann),
        mean_absolute_error(y_test,      y_pred_test_lr),
        mean_absolute_error(y_test_svm,  y_pred_test_svm),
        mean_absolute_error(y_test,      y_pred_test_rf)
    ],

    "Price_R2": [
        r2_score(actual_price_shared, pred_price_xgb_shared),
        r2_score(actual_price_shared, pred_price_ann_shared),
        r2_score(actual_price_shared, pred_price_lr_shared),
        r2_score(actual_price_shared, pred_price_svm_shared),
        r2_score(actual_price_shared, pred_price_rf_shared)
    ],

    "Price_MAE": [
        mean_absolute_error(actual_price_shared, pred_price_xgb_shared),
        mean_absolute_error(actual_price_shared, pred_price_ann_shared),
        mean_absolute_error(actual_price_shared, pred_price_lr_shared),
        mean_absolute_error(actual_price_shared, pred_price_svm_shared),
        mean_absolute_error(actual_price_shared, pred_price_rf_shared)
    ]
}

results_df = pd.DataFrame(results)

print("\nMODEL COMPARISON:")
print(results_df)


plt.figure(figsize=(12, 6))

plt.plot(results_df["Model"], results_df["Norm_R2"],  marker='o', label="Norm R2")
plt.plot(results_df["Model"], results_df["Price_R2"], marker='s', label="Price R2")

for i, val in enumerate(results_df["Norm_R2"]):
    plt.text(i, val, f'{val:.4f}', ha='center', va='bottom')
for i, val in enumerate(results_df["Price_R2"]):
    plt.text(i, val, f'{val:.4f}', ha='center', va='top')

plt.title("Model Comparison")
plt.xlabel("Models")
plt.ylabel("Score")
plt.legend()
plt.grid()
plt.show()



kfold_results = {
    "Model": ["XGBoost", "ANN", "Linear", "SVM", "RandomForest"],
    "Mean_Norm_R2": [
        np.mean(xgb_norm_r2), np.mean(ann_norm_r2), np.mean(lr_norm_r2),
        np.mean(svm_norm_r2), np.mean(rf_norm_r2)
    ],
    "Mean_Norm_MAE": [
        np.mean(xgb_norm_mae), np.mean(ann_norm_mae), np.mean(lr_norm_mae),
        np.mean(svm_norm_mae), np.mean(rf_norm_mae)
    ],
    "Mean_Price_R2": [
        np.mean(xgb_price_r2), np.mean(ann_price_r2), np.mean(lr_price_r2),
        np.mean(svm_price_r2), np.mean(rf_price_r2)
    ],
    "Mean_Price_MAE": [
        np.mean(xgb_price_mae), np.mean(ann_price_mae), np.mean(lr_price_mae),
        np.mean(svm_price_mae), np.mean(rf_price_mae)
    ]
}
kfold_df = pd.DataFrame(kfold_results)

print("\nK-FOLD MEAN RESULTS ")
print(kfold_df)





folds = np.arange(1, len(xgb_norm_r2) + 1)

plt.figure(figsize=(16, 6))

plt.subplot(1, 2, 1)
plt.plot(folds, xgb_norm_r2, marker='o', label='XGBoost')
plt.plot(folds, ann_norm_r2, marker='s', label='ANN')
plt.plot(folds, lr_norm_r2,  marker='^', label='Linear Regression')
plt.plot(folds, svm_norm_r2, marker='d', label='SVM')
plt.plot(folds, rf_norm_r2,  marker='p', label='Random Forest')
plt.title("K-Fold Z-Score Norm Prediction R2")
plt.xlabel("Fold")
plt.ylabel("R2 Score")
plt.xticks(folds)
plt.legend()
plt.grid()

plt.subplot(1, 2, 2)
plt.plot(folds, xgb_price_r2, marker='o', label='XGBoost')
plt.plot(folds, ann_price_r2, marker='s', label='ANN')
plt.plot(folds, lr_price_r2,  marker='^', label='Linear Regression')
plt.plot(folds, svm_price_r2, marker='d', label='SVM')
plt.plot(folds, rf_price_r2,  marker='p', label='Random Forest')
plt.title("K-Fold Price Prediction R2 (Z-Score)")
plt.xlabel("Fold")
plt.ylabel("R2 Score")
plt.xticks(folds)
plt.legend()
plt.grid()

plt.figure(figsize=(8, 6))
plt.plot(folds, xgb_signal_acc, marker='o', label='XGBoost')
plt.plot(folds, ann_signal_acc, marker='s', label='ANN')
plt.plot(folds, lr_signal_acc,  marker='^', label='Linear Regression')
plt.plot(folds, svm_signal_acc, marker='d', label='SVM')
plt.plot(folds, rf_signal_acc,  marker='p', label='Random Forest')
plt.title("K-Fold Signal Classification Accuracy")
plt.xlabel("Fold")
plt.ylabel("Accuracy Score")
plt.xticks(folds)
plt.legend()
plt.grid()

plt.tight_layout()
plt.show()



'''eval_set = [(X_train, y_train), (X_test, y_test)]

model = XGBRegressor(
    n_estimators=500,
    max_depth=5,
    learning_rate=0.03,
    subsample=0.9,
    colsample_bytree=0.9,
    eval_metric="mae",
    random_state=42
)

model.fit(
    X_train, y_train,
    eval_set=eval_set,
    verbose=False
)

xgb_results    = model.evals_result()
xgb_train_error = xgb_results['validation_0']['mae']
xgb_test_error  = xgb_results['validation_1']['mae']

ann = MLPRegressor(
    hidden_layer_sizes=(64, 32),
    max_iter=500,
    random_state=42
)

ann.fit(X_train_s, y_train)

ann_error = ann.loss_curve_

rf_errors = []

for i in range(1, 501, 10):
    rf_temp = RandomForestRegressor(n_estimators=i, max_depth=5, random_state=42)
    rf_temp.fit(X_train, y_train)
    pred = rf_temp.predict(X_test)
    rf_errors.append(mean_absolute_error(y_test, pred))

svm_errors = []

for i in range(10, 501, 50):
    svm_temp = SVR(max_iter=i)
    svm_temp.fit(X_train_s, y_train)
    pred = svm_temp.predict(X_test_s)
    svm_errors.append(mean_absolute_error(y_test, pred))

lr_error  = mean_absolute_error(y_test, y_pred_test_lr)
lr_errors = [lr_error] * 50

plt.figure(figsize=(12, 6))

plt.plot(range(1, len(xgb_test_error) + 1), xgb_test_error,            label="XGBoost")
plt.plot(range(1, len(ann_error) + 1),       ann_error,                 label="ANN")
plt.plot(range(1, len(rf_errors) * 10 + 1, 10), rf_errors,             label="RandomForest")
plt.plot(range(10, len(svm_errors) * 50 + 10, 50), svm_errors,         label="SVM")
plt.plot(range(1, len(lr_errors) + 1),       lr_errors,                 label="Linear")

plt.title("Error Reduction from Iteration 1 to 500")
plt.xlabel("Iterations")
plt.ylabel("MAE (Error)")
plt.legend()
plt.grid()

plt.show()'''
