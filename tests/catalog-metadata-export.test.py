import importlib.util
import json
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("catalog_export", Path(__file__).parents[1] / "scripts/catalog-metadata-export.py")
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)


class ExportTest(unittest.TestCase):
    def row(self, token_id="900719925474099312345"):
        return {"token_contract": "0x" + "Aa" * 20, "token_id": token_id, "metadata_uri": "ipfs://original", "metadata": json.dumps({"body": {"notes": "120 BPM"}})}

    def export(self, row, known=None, duplicate=False):
        key = exporter.token_key(row["token_contract"], row["token_id"])
        return exporter.export_records({"cnft": [row], "media": [row] if duplicate else []}, {key} if known is None else known, "2026-03-09", {"cnft": "hash", "media": "hash2"})

    def test_preserves_exact_token_original_document_and_provenance(self):
        row = self.row()
        result = self.export(row)
        entry = result["1-" + row["token_contract"].lower() + "-" + row["token_id"]]
        self.assertEqual(entry["metadata"], {"body": {"notes": "120 BPM"}})
        self.assertEqual(entry["snapshotTable"], "cnft")
        self.assertEqual(entry["snapshotTableSha256"], "hash")
        self.assertEqual(entry["source"], "ipfs://original")

    def test_rejects_identity_not_in_census(self):
        with self.assertRaises(ValueError):
            self.export(self.row(), known=set())

    def test_rejects_duplicate_identity(self):
        with self.assertRaises(ValueError):
            self.export(self.row(), duplicate=True)

    def test_rejects_lossy_numeric_id_and_invalid_contract(self):
        with self.assertRaises(ValueError):
            exporter.token_key("0x" + "a" * 40, 9007199254740993)
        with self.assertRaises(ValueError):
            exporter.token_key("0xinvalid", "1")

    def test_missing_document_is_not_an_empty_success(self):
        row = self.row()
        row["metadata"] = None
        self.assertEqual(self.export(row), {})


if __name__ == "__main__":
    unittest.main()
