# 13-filtering

**1 MATCH / 27 DIFF** out of 28 tests

| # | Test | Method | PHP | Node | Result |
|---|------|--------|-----|------|--------|
| 01 | #1 GET /object (all products) | GET | 200 | 200 | DIFF |
| 02 | #2 GET /object (LIMIT=3) | GET | 200 | 200 | DIFF |
| 03 | #3 GET /object (pg=2, LIMIT=3) | GET | 200 | 200 | DIFF |
| 04 | #4 GET /object (pg=3, LIMIT=3) | GET | 200 | 200 | DIFF |
| 05 | #5 GET /object (LIMIT=0 count) | GET | 200 | 200 | DIFF |
| 06 | #6 GET /object (F_T val=iPhone) | GET | 500 | 200 | DIFF |
| 07 | #7 GET /object (F_T val=Мол) | GET | 500 | 200 | DIFF |
| 08 | #8 GET /object (F_T val=ZZZZZ) | GET | 500 | 200 | DIFF |
| 09 | #9 GET /object (F_T on req field) | GET | 500 | 200 | DIFF |
| 10 | #10 GET /object (F_I ref=Electronics) | GET | 500 | 200 | DIFF |
| 11 | #11 GET /object (F_I bool=1) | GET | 500 | 200 | DIFF |
| 12 | #12 GET /object (F_I bool=0) | GET | 500 | 200 | DIFF |
| 13 | #13 GET /object (F_I text exact) | GET | 500 | 200 | DIFF |
| 14 | #14 GET /object (F_I + LIMIT=2) | GET | 500 | 200 | DIFF |
| 15 | #15 GET /object (sort val ASC) | GET | 200 | 200 | DIFF |
| 16 | #16 GET /object (sort val DESC) | GET | 200 | 200 | DIFF |
| 17 | #17 GET /object (sort by price) | GET | 200 | 200 | DIFF |
| 18 | #18 GET /object (sort by date DESC) | GET | 200 | 200 | DIFF |
| 19 | #19 GET /object (F_I + sort) | GET | 500 | 200 | DIFF |
| 20 | #20 GET /object (F_I + sort + LIMIT=2) | GET | 500 | 200 | DIFF |
| 21 | #21 GET /object (F_I cat + F_I active) | GET | 500 | 200 | DIFF |
| 22 | #22 GET /object (F_T + F_I) | GET | 500 | 200 | DIFF |
| 23 | #23 GET /object (pg=100, beyond data) | GET | 200 | 200 | DIFF |
| 24 | #24 GET /object (LIMIT=1) | GET | 200 | 200 | MATCH |
| 25 | #25 GET /object (LIMIT=1000) | GET | 200 | 200 | DIFF |
| 26 | #26 GET /object (F_I non-existent ref) | GET | 500 | 200 | DIFF |
| 27 | #27 GET /object (F_T empty) | GET | 200 | 200 | DIFF |
| 28 | #28 GET /object (F_T on LONG field) | GET | 500 | 200 | DIFF |

---
### DIFF 01: #1 GET /object (all products)

- **PHP path:** `/object/1000008339?JSON=1`
- **Node path:** `/object/1000008339?JSON=1`
- **PHP status:** 200
- **Node status:** 200

- val[reqs]: PHP={"__ID__":{"__ID__":"X"}} Node={"__ID__":{"__ID__":"1"}}

Full responses: [01-php.json](./01-php.json) | [01-node.json](./01-node.json)

---
### DIFF 02: #2 GET /object (LIMIT=3)

- **PHP path:** `/object/1000008339?LIMIT=3&JSON=1`
- **Node path:** `/object/1000008339?LIMIT=3&JSON=1`
- **PHP status:** 200
- **Node status:** 200

- val[reqs]: PHP={"__ID__":{"__ID__":"X"}} Node={"__ID__":{"__ID__":"1"}}

Full responses: [02-php.json](./02-php.json) | [02-node.json](./02-node.json)

---
### DIFF 03: #3 GET /object (pg=2, LIMIT=3)

- **PHP path:** `/object/1000008339?LIMIT=3&pg=2&JSON=1`
- **Node path:** `/object/1000008339?LIMIT=3&pg=2&JSON=1`
- **PHP status:** 200
- **Node status:** 200

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]

Full responses: [03-php.json](./03-php.json) | [03-node.json](./03-node.json)

---
### DIFF 04: #4 GET /object (pg=3, LIMIT=3)

- **PHP path:** `/object/1000008339?LIMIT=3&pg=3&JSON=1`
- **Node path:** `/object/1000008339?LIMIT=3&pg=3&JSON=1`
- **PHP status:** 200
- **Node status:** 200

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]

Full responses: [04-php.json](./04-php.json) | [04-node.json](./04-node.json)

---
### DIFF 05: #5 GET /object (LIMIT=0 count)

- **PHP path:** `/object/1000008339?LIMIT=0&JSON=1`
- **Node path:** `/object/1000008339?LIMIT=0&JSON=1`
- **PHP status:** 200
- **Node status:** 200

- val[reqs]: PHP={"__ID__":{"__ID__":"X"}} Node={"__ID__":{"__ID__":"1"}}

Full responses: [05-php.json](./05-php.json) | [05-node.json](./05-node.json)

---
### DIFF 06: #6 GET /object (F_T val=iPhone)

- **PHP path:** `/object/1000008339?F_T=iPhone&JSON=1`
- **Node path:** `/object/1000008339?F_T=iPhone&JSON=1`
- **PHP status:** 500
- **Node status:** 200

- status: PHP=500 Node=200
- format: PHP=text Node=JSON

Full responses: [06-php.json](./06-php.json) | [06-node.json](./06-node.json)

---
### DIFF 07: #7 GET /object (F_T val=Мол)

- **PHP path:** `/object/1000008339?F_T=%D0%9C%D0%BE%D0%BB&JSON=1`
- **Node path:** `/object/1000008339?F_T=%D0%9C%D0%BE%D0%BB&JSON=1`
- **PHP status:** 500
- **Node status:** 200

- status: PHP=500 Node=200
- format: PHP=text Node=JSON

Full responses: [07-php.json](./07-php.json) | [07-node.json](./07-node.json)

---
### DIFF 08: #8 GET /object (F_T val=ZZZZZ)

- **PHP path:** `/object/1000008339?F_T=ZZZZZ&JSON=1`
- **Node path:** `/object/1000008339?F_T=ZZZZZ&JSON=1`
- **PHP status:** 500
- **Node status:** 200

- status: PHP=500 Node=200
- format: PHP=text Node=JSON

Full responses: [08-php.json](./08-php.json) | [08-node.json](./08-node.json)

---
### DIFF 09: #9 GET /object (F_T on req field)

- **PHP path:** `/object/1000008339?F_T[1000008340]=Apple&JSON=1`
- **Node path:** `/object/1000008339?F_T[1000008340]=Apple&JSON=1`
- **PHP status:** 500
- **Node status:** 200

- status: PHP=500 Node=200
- format: PHP=text Node=JSON

Full responses: [09-php.json](./09-php.json) | [09-node.json](./09-node.json)

---
### DIFF 10: #10 GET /object (F_I ref=Electronics)

- **PHP path:** `/object/1000008339?F_I[1000008352]=1000008347&JSON=1`
- **Node path:** `/object/1000008339?F_I[1000008352]=1000008346&JSON=1`
- **PHP status:** 500
- **Node status:** 200

- status: PHP=500 Node=200
- format: PHP=text Node=JSON

Full responses: [10-php.json](./10-php.json) | [10-node.json](./10-node.json)

---
### DIFF 11: #11 GET /object (F_I bool=1)

- **PHP path:** `/object/1000008339?F_I[1000008344]=1&JSON=1`
- **Node path:** `/object/1000008339?F_I[1000008344]=1&JSON=1`
- **PHP status:** 500
- **Node status:** 200

- status: PHP=500 Node=200
- format: PHP=text Node=JSON

Full responses: [11-php.json](./11-php.json) | [11-node.json](./11-node.json)

---
### DIFF 12: #12 GET /object (F_I bool=0)

- **PHP path:** `/object/1000008339?F_I[1000008344]=0&JSON=1`
- **Node path:** `/object/1000008339?F_I[1000008344]=0&JSON=1`
- **PHP status:** 500
- **Node status:** 200

- status: PHP=500 Node=200
- format: PHP=text Node=JSON

Full responses: [12-php.json](./12-php.json) | [12-node.json](./12-node.json)

---
### DIFF 13: #13 GET /object (F_I text exact)

- **PHP path:** `/object/1000008339?F_I[1000008340]=%D0%A5%D0%BB%D0%B5%D0%B1&JSON=1`
- **Node path:** `/object/1000008339?F_I[1000008340]=%D0%A5%D0%BB%D0%B5%D0%B1&JSON=1`
- **PHP status:** 500
- **Node status:** 200

- status: PHP=500 Node=200
- format: PHP=text Node=JSON

Full responses: [13-php.json](./13-php.json) | [13-node.json](./13-node.json)

---
### DIFF 14: #14 GET /object (F_I + LIMIT=2)

- **PHP path:** `/object/1000008339?F_I[1000008352]=1000008347&LIMIT=2&JSON=1`
- **Node path:** `/object/1000008339?F_I[1000008352]=1000008346&LIMIT=2&JSON=1`
- **PHP status:** 500
- **Node status:** 200

- status: PHP=500 Node=200
- format: PHP=text Node=JSON

Full responses: [14-php.json](./14-php.json) | [14-node.json](./14-node.json)

---
### DIFF 15: #15 GET /object (sort val ASC)

- **PHP path:** `/object/1000008339?sort=val&asc=1&JSON=1`
- **Node path:** `/object/1000008339?sort=val&asc=1&JSON=1`
- **PHP status:** 200
- **Node status:** 200

- val[reqs]: PHP={"__ID__":{"__ID__":"X"}} Node={"__ID__":{"__ID__":"1"}}

Full responses: [15-php.json](./15-php.json) | [15-node.json](./15-node.json)

---
### DIFF 16: #16 GET /object (sort val DESC)

- **PHP path:** `/object/1000008339?sort=val&desc=1&JSON=1`
- **Node path:** `/object/1000008339?sort=val&desc=1&JSON=1`
- **PHP status:** 200
- **Node status:** 200

- val[reqs]: PHP={"__ID__":{"__ID__":"X"}} Node={"__ID__":{"__ID__":"1"}}

Full responses: [16-php.json](./16-php.json) | [16-node.json](./16-node.json)

---
### DIFF 17: #17 GET /object (sort by price)

- **PHP path:** `/object/1000008339?sort=1000008341&asc=1&JSON=1`
- **Node path:** `/object/1000008339?sort=1000008341&asc=1&JSON=1`
- **PHP status:** 200
- **Node status:** 200

- val[reqs]: PHP={"__ID__":{"__ID__":"X"}} Node={"__ID__":{"__ID__":"1"}}

Full responses: [17-php.json](./17-php.json) | [17-node.json](./17-node.json)

---
### DIFF 18: #18 GET /object (sort by date DESC)

- **PHP path:** `/object/1000008339?sort=1000008342&desc=1&JSON=1`
- **Node path:** `/object/1000008339?sort=1000008342&desc=1&JSON=1`
- **PHP status:** 200
- **Node status:** 200

- val[reqs]: PHP={"__ID__":{"__ID__":"X"}} Node={"__ID__":{"__ID__":"1"}}

Full responses: [18-php.json](./18-php.json) | [18-node.json](./18-node.json)

---
### DIFF 19: #19 GET /object (F_I + sort)

- **PHP path:** `/object/1000008339?F_I[1000008352]=1000008347&sort=1000008341&desc=1&JSON=1`
- **Node path:** `/object/1000008339?F_I[1000008352]=1000008346&sort=1000008341&desc=1&JSON=1`
- **PHP status:** 500
- **Node status:** 200

- status: PHP=500 Node=200
- format: PHP=text Node=JSON

Full responses: [19-php.json](./19-php.json) | [19-node.json](./19-node.json)

---
### DIFF 20: #20 GET /object (F_I + sort + LIMIT=2)

- **PHP path:** `/object/1000008339?F_I[1000008352]=1000008347&sort=1000008341&asc=1&LIMIT=2&JSON=1`
- **Node path:** `/object/1000008339?F_I[1000008352]=1000008346&sort=1000008341&asc=1&LIMIT=2&JSON=1`
- **PHP status:** 500
- **Node status:** 200

- status: PHP=500 Node=200
- format: PHP=text Node=JSON

Full responses: [20-php.json](./20-php.json) | [20-node.json](./20-node.json)

---
### DIFF 21: #21 GET /object (F_I cat + F_I active)

- **PHP path:** `/object/1000008339?F_I[1000008352]=1000008347&F_I[1000008344]=1&JSON=1`
- **Node path:** `/object/1000008339?F_I[1000008352]=1000008346&F_I[1000008344]=1&JSON=1`
- **PHP status:** 500
- **Node status:** 200

- status: PHP=500 Node=200
- format: PHP=text Node=JSON

Full responses: [21-php.json](./21-php.json) | [21-node.json](./21-node.json)

---
### DIFF 22: #22 GET /object (F_T + F_I)

- **PHP path:** `/object/1000008339?F_T=Pro&F_I[1000008352]=1000008347&JSON=1`
- **Node path:** `/object/1000008339?F_T=Pro&F_I[1000008352]=1000008346&JSON=1`
- **PHP status:** 500
- **Node status:** 200

- status: PHP=500 Node=200
- format: PHP=text Node=JSON

Full responses: [22-php.json](./22-php.json) | [22-node.json](./22-node.json)

---
### DIFF 23: #23 GET /object (pg=100, beyond data)

- **PHP path:** `/object/1000008339?LIMIT=3&pg=100&JSON=1`
- **Node path:** `/object/1000008339?LIMIT=3&pg=100&JSON=1`
- **PHP status:** 200
- **Node status:** 200

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]

Full responses: [23-php.json](./23-php.json) | [23-node.json](./23-node.json)

---
### DIFF 25: #25 GET /object (LIMIT=1000)

- **PHP path:** `/object/1000008339?LIMIT=1000&JSON=1`
- **Node path:** `/object/1000008339?LIMIT=1000&JSON=1`
- **PHP status:** 200
- **Node status:** 200

- val[reqs]: PHP={"__ID__":{"__ID__":"X"}} Node={"__ID__":{"__ID__":"1"}}

Full responses: [25-php.json](./25-php.json) | [25-node.json](./25-node.json)

---
### DIFF 26: #26 GET /object (F_I non-existent ref)

- **PHP path:** `/object/1000008339?F_I[1000008352]=999999999&JSON=1`
- **Node path:** `/object/1000008339?F_I[1000008352]=999999999&JSON=1`
- **PHP status:** 500
- **Node status:** 200

- status: PHP=500 Node=200
- format: PHP=text Node=JSON

Full responses: [26-php.json](./26-php.json) | [26-node.json](./26-node.json)

---
### DIFF 27: #27 GET /object (F_T empty)

- **PHP path:** `/object/1000008339?F_T=&JSON=1`
- **Node path:** `/object/1000008339?F_T=&JSON=1`
- **PHP status:** 200
- **Node status:** 200

- val[reqs]: PHP={"__ID__":{"__ID__":"X"}} Node={"__ID__":{"__ID__":"1"}}

Full responses: [27-php.json](./27-php.json) | [27-node.json](./27-node.json)

---
### DIFF 28: #28 GET /object (F_T on LONG field)

- **PHP path:** `/object/1000008339?F_T[1000008343]=%D0%A2%D0%BE%D0%BB%D1%81%D1%82%D0%BE%D0%B9&JSON=1`
- **Node path:** `/object/1000008339?F_T[1000008343]=%D0%A2%D0%BE%D0%BB%D1%81%D1%82%D0%BE%D0%B9&JSON=1`
- **PHP status:** 500
- **Node status:** 200

- status: PHP=500 Node=200
- format: PHP=text Node=JSON

Full responses: [28-php.json](./28-php.json) | [28-node.json](./28-node.json)