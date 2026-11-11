import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import test_api
import unittest


class TagsApiTest(unittest.TestCase):
    setUp = test_api.DashboardApiTest.setUp
    tearDown = test_api.DashboardApiTest.tearDown
    _patch_data_dir = test_api.DashboardApiTest._patch_data_dir
    _write_collect_config = test_api.DashboardApiTest._write_collect_config

    def test_project_catalog_includes_empty_projects(self):
        from test_hermes_projects import projects_db

        home = Path(self.data_dir) / "hermes"
        home.mkdir()
        projects_db(home)
        self._write_collect_config({}, home)
        with self._patch_data_dir():
            response = self.client.get("/projects")
            assert response.status_code == 200, response.text
            projects = response.json()["projects"]
            assert {p["key"] for p in projects} == {"default:a", "default:b"}
            assert all(p["open_count"] == 0 for p in projects)

    def test_tags_api_and_filters(self):
        with self._patch_data_dir():
            self._write_collect_config(
                {"local_profiles": [], "remote_hosts": []},
                Path(self.data_dir) / "hermes",
            )
            s = self.api.Store(str(Path(self.data_dir) / "wou.db"))
            ids = [
                s.upsert_task("c", "A", "T", ask, "Topic", 2, "m")
                for ask in ["First", "Second"]
            ]
            s.refresh_chat_project(
                "c", {"key": "work:p", "name": "Work", "slug": "work", "color": "blue"}
            )
            s.close()
            r = self.client.post("/tags", json={"name": "Client", "color": "green"})
            assert r.status_code == 200, r.text
            tag = r.json()["tag"]["id"]
            assert (
                self.client.post(
                    f"/tasks/{ids[0]}/tags", json={"add": [tag]}
                ).status_code
                == 200
            )
            tasks = self.client.get(
                "/tasks", params=[("tag", tag), ("project", "work:p")]
            ).json()["tasks"]
            assert len(tasks) == 1
            assert tasks[0]["tags"][0]["name"] == "Client"
            assert self.client.get("/tasks?project=none").json()["tasks"] == []
            r = self.client.patch("/groups/c", json={"tags_add": [tag]})
            assert r.status_code == 200, r.text
            assert len(self.client.get(f"/tasks?tag={tag}").json()["tasks"]) == 2
            assert self.client.get("/tags").json()["tags"][0]["open_count"] == 2
            assert (
                self.client.patch(f"/tags/{tag}", json={"name": "Renamed"}).json()[
                    "tag"
                ]["name"]
                == "Renamed"
            )
            assert (
                self.client.patch(
                    f"/tasks/{ids[0]}", json={"project_id": 1}
                ).status_code
                == 400
            )
            assert self.client.post("/projects", json={"name": "No"}).status_code == 405
            projects = self.client.get("/projects").json()
            assert projects["projects"][0]["key"] == "work:p"
            assert projects["no_project_count"] == 0
            assert self.client.delete(f"/tags/{tag}").status_code == 200
            assert self.client.get("/tags").json()["tags"] == []
