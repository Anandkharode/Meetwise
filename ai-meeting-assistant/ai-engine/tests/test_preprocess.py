"""Unit tests for transcript preprocessing behavior."""

import unittest

from app.nlp.preprocess import clean_text, normalize_whitespace, preprocess_text
from app.nlp.pipeline import get_nlp


class PreprocessTests(unittest.TestCase):
    """Verify transcript cleanup and NLP output with the local model."""

    def test_normalize_whitespace_collapses_spaces_and_newlines(self) -> None:
        self.assertEqual(normalize_whitespace("  Hello\n\tworld!  "), "Hello world!")

    def test_clean_text_removes_control_characters(self) -> None:
        self.assertEqual(clean_text("hello\x00  world"), "hello world")

    def test_preprocess_returns_sentences_and_lowercase_tokens(self) -> None:
        result = preprocess_text("  Alice will send notes. Bob will review them!  ")
        self.assertEqual(result["cleaned_text"], "Alice will send notes. Bob will review them!")
        self.assertEqual(len(result["sentences"]), 2)
        self.assertIn("alice", result["tokens"])
        self.assertIn("!", result["tokens"])

    def test_empty_input_returns_empty_collections(self) -> None:
        self.assertEqual(
            preprocess_text(" \n\t ", nlp=get_nlp()),
            {"cleaned_text": "", "sentences": [], "tokens": []},
        )


if __name__ == "__main__":
    unittest.main()
