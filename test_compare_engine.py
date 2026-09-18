import unittest

from compare_engine import compare_results, find_domain_position


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


if __name__ == "__main__":
    unittest.main()
