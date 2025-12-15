---
description: Backup server data (database and env config)
---
# Backup Server Data

## Server Info
- **IP**: 43.132.214.236
- **Remote Path**: /www/generator/server/
- **Local Backup Path**: ./backups/

## Steps

### 1. Create Local Backup Directory
```bash
mkdir -p backups
```

### 2. Download Database (`data.db`)
// turbo
```bash
scp root@43.132.214.236:/www/generator/server/data.db backups/data_$(date +%Y%m%d_%H%M%S).db
```

### 3. Download Environment Config (`.env`) - Optional
// turbo
```bash
scp root@43.132.214.236:/www/generator/server/.env backups/.env.backup
```

> [!NOTE]
> `data.db` contains all user data, points, and logs. `sql.js` (used in this project) writes to this file.
> It is recommended to run this backup periodically.
