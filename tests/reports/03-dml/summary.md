# 03-dml

**13 MATCH / 3 DIFF** out of 16 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | POST /_m_new | POST | 200 | 200 | MATCH |
| 02 | POST /_m_new (empty val) | POST | 200 | 200 | DIFF |
| 03 | POST /_m_save (rename) | POST | 200 | 200 | MATCH |
| 04 | POST /_m_save (copy) | POST | 200 | 200 | MATCH |
| 05 | POST /_m_set (text) | POST | 200 | 200 | DIFF |
| 06 | POST /_m_set (number) | POST | 200 | 200 | MATCH |
| 07 | POST /_m_set (clear) | POST | 200 | 200 | DIFF |
| 08 | POST /_m_up | POST | 200 | 200 | MATCH |
| 09 | POST /_m_ord (order=5) | POST | 200 | 200 | MATCH |
| 10 | POST /_m_move (to root) | POST | 200 | 200 | MATCH |
| 11 | POST /_m_id | POST | 200 | 200 | MATCH |
| 12 | POST /_m_id (duplicate) | POST | 200 | 200 | MATCH |
| 13 | POST /_m_id (zero) | POST | 200 | 200 | MATCH |
| 14 | POST /_m_del | POST | 200 | 200 | MATCH |
| 15 | POST /_m_del (non-existent) | POST | 200 | 200 | MATCH |
| 16 | POST /_d_del (type with objects) | POST | 200 | 200 | MATCH |

---
### DIFF 02: POST /_m_new (empty val)

- **PHP path:** `/_m_new/1000008138`
- **Node path:** `/_m_new/1000008138`
- **PHP status:** 200
- **Node status:** 200

- val[val]: PHP="1" Node="5"

Full responses: [02-php.json](./02-php.json) | [02-node.json](./02-node.json)

---
### DIFF 05: POST /_m_set (text)

- **PHP path:** `/_m_set/1000008144`
- **Node path:** `/_m_set/1000008143`
- **PHP status:** 200
- **Node status:** 200

- type: PHP=object Node=array

Full responses: [05-php.json](./05-php.json) | [05-node.json](./05-node.json)

---
### DIFF 07: POST /_m_set (clear)

- **PHP path:** `/_m_set/1000008146`
- **Node path:** `/_m_set/1000008145`
- **PHP status:** 200
- **Node status:** 200

- type: PHP=object Node=array

Full responses: [07-php.json](./07-php.json) | [07-node.json](./07-node.json)