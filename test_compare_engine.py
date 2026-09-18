import unittest
from unittest.mock import Mock, patch

from compare_engine import compare_results, find_domain_position
from serper_client import search_keyword


def organic(*links):
    return [{"link": link, "position": index} for index, link in enumerate(links, 1)]


class TargetRankTests(unittest.TestCase):
    def test_matches_root_and_subdomain(self):
        results = organic("https://example.com/page", "https://blog.example.com/post")
        self.assertEqual(find_domain_position(results, "www.example.com"), 1)

    def test_reports_improved_target_position(self):
        old = {"organic": organic("https://example.com/page", "https://other.test")}
        new = {"organic": organic("https://other.test", "https://example.com/page")}
        result = compare_results(old, new, "example.com")
        self.assertEqual(result["target_position"], 2)
        self.assertEqual(result["previous_target_position"], 1)
        self.assertEqual(result["target_position_change"], -1)
        self.assertEqual(result["target_direction"], "declined")
        self.assertTrue(result["has_changes"])

    def test_first_run_is_baseline(self):
        result = compare_results(None, {"organic": organic("https://example.com")}, "example.com")
        self.assertTrue(result["first_run"])
        self.assertEqual(result["target_position"], 1)
        self.assertEqual(result["target_direction"], "baseline")
        self.assertFalse(result["has_changes"])


class SearchConfigTests(unittest.TestCase):
    @patch("serper_client.requests.post")
    def test_search_config_is_sent_to_serper(self, post):
        response = Mock()
        response.json.return_value = {"organic": []}
        post.return_value = response

        search_keyword(
            "seo ajansı",
            "test-key",
            {
                "country_code": "gb",
                "language_code": "en",
                "location": "London, United Kingdom",
                "device": "mobile",
            },
        )

        self.assertEqual(
            post.call_args.kwargs["json"],
            {
                "q": "seo ajansı",
                "gl": "gb",
                "hl": "en",
                "location": "London, United Kingdom",
                "device": "mobile",
            },
        )


if __name__ == "__main__":
    unittest.main()
