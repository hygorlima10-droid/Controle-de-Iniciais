-- Uma única tabela guarda todos os registros do app (petições, acordos, finanças...).
CREATE TABLE IF NOT EXISTS docs (
  colecao    TEXT NOT NULL,
  id         TEXT NOT NULL,
  dados      TEXT NOT NULL,
  atualizado INTEGER NOT NULL,
  PRIMARY KEY (colecao, id)
);
CREATE INDEX IF NOT EXISTS idx_docs_colecao ON docs (colecao, atualizado);
