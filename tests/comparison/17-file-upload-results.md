# 17-file-upload — File Upload, Download, Blacklist

5 MATCH / 2 DIFF out of 7 tests

| # | Test | PHP | Node | Result |
|---|------|-----|------|--------|
| 1 | #2 GET /edit_obj (after upload) | 200 | 200 | MATCH |
| 2 | #3 GET /object (listing with file) | 200 | 200 | DIFF: keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] |
| 3 | #5 GET /edit_obj (after _m_set upload) | 200 | 200 | MATCH |
| 4 | #7 GET /edit_obj (after replace) | 200 | 200 | MATCH |
| 5 | #8 POST /_m_set (clear file) | 200 | 200 | MATCH |
| 6 | #9 GET /edit_obj (after clear) | 200 | 200 | MATCH |
| 7 | #15 GET /object (final state) | 200 | 200 | DIFF: val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","LEFT","LEFT","LEFT"],"... Node={"align":["LEFT","LEFT","LEFT","LEFT"],"... |

## Diffs Detail

### #3 GET /object (listing with file)

- keys: PHP=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...] Node=[&main.a,&main.a.&uni_obj,&main.a.&uni_obj.&delete,&main.a.&u...]
- val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","LEFT","LEFT","LEFT"],"... Node={"align":["LEFT","LEFT","LEFT","LEFT"],"...
- val[reqs]: PHP={"__ID__":{"__ID__":"<a target=\"_blank\... Node=
- PHP: `{"&main.a":{"_parent_.title":["__file_docs_1773722656863"]},"type":{"id":1000031699,"up":1,"val":"__file_docs_1773722656863","base":"SHORT"},"base":{"...`
- Node: `{"&main.a":{"_parent_.title":["__file_docs_1773722656863"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"fil...`

### #15 GET /object (final state)

- val[&main.a.&uni_obj.&uni_obj_all.&uni_object_view_reqs]: PHP={"align":["LEFT","LEFT","LEFT","LEFT"],"... Node={"align":["LEFT","LEFT","LEFT","LEFT"],"...
- val[&object_reqs]: PHP={"__ID__":["","<a target=\"_blank\" href... Node={"__ID__":["","<a target=\"_blank\" href...
- val[reqs]: PHP={"__ID__":{"__ID__":"<a target=\"_blank\... Node={"__ID__":{"__ID__":"<a target=\"_blank\...
- PHP: `{"&main.a":{"_parent_.title":["__file_docs_1773722656863"]},"type":{"id":1000031699,"up":1,"val":"__file_docs_1773722656863","base":"SHORT"},"base":{"...`
- Node: `{"&main.a":{"_parent_.title":["__file_docs_1773722656863"]},"&main.a.&uni_obj":{"base_typ":["3"],"create_granted":["block"],"f_i":[""],"f_u":[""],"fil...`
