import sys
import pytest
import time
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from tests_py import test_api as fixtures
from fastapi import FastAPI
from fastapi.testclient import TestClient


@pytest.mark.parametrize('value', [-1, 366, 1.5, True, 'forever'])
def test_retention_setting_validation_does_not_silently_coerce(tmp_path, value):
    api = fixtures._load_api_module()
    app = FastAPI()
    app.include_router(api.router)
    with mock.patch.object(api, 'plugin_data_directory', return_value=tmp_path), TestClient(app) as client:
        assert client.get('/settings').json()['settings']['retention_days'] == 0
        response = client.patch('/settings', json={'retention_days': value})
        assert response.status_code == 400, response.text
        assert client.get('/settings').json()['settings']['retention_days'] == 0
        assert client.patch('/settings', json={'retention_days': 0}).status_code == 200
        assert client.get('/settings').json()['settings']['retention_days'] == 0


def test_explicit_group_close_handles_snoozed_member_when_only_one_visible(tmp_path):
    api = fixtures._load_api_module()
    app = FastAPI()
    app.include_router(api.router)
    with mock.patch.object(api, 'plugin_data_directory', return_value=tmp_path):
        store = api.Store(str(tmp_path / 'wou.db'))
        first = store.upsert_task('c', 'A', 'T', 'First?', 'One', 2, 'm')
        snoozed = store.upsert_task('c', 'A', 'T', 'Other?', 'Two', 2, 'm')
        store.snooze_task(snoozed, time.time() + 86400)
        store.close()
        with TestClient(app) as client:
            response = client.patch('/groups/c', json={'status': 'dismissed', 'task_ids': [snoozed]})
        assert response.status_code == 200, response.text
        assert response.json()['closed_task_ids'] == [snoozed]
        store = api.Store(str(tmp_path / 'wou.db'))
        assert store.get_task(first)['status'] == 'open'
        assert store.get_task(snoozed)['status'] == 'dismissed'
        store.close()


def test_group_done_does_not_archive_hidden_snoozed_task(tmp_path):
    api = fixtures._load_api_module()
    app = FastAPI()
    app.include_router(api.router)
    with mock.patch.object(api, 'plugin_data_directory', return_value=tmp_path):
        api._settings.save_settings(tmp_path, {'archive_chat_on_done': True})
        store = api.Store(str(tmp_path / 'wou.db'))
        ids = [store.upsert_task('c', 'A', 'T', f'Ask {i}?', f'Topic {i}', 2, 'm') for i in range(3)]
        store.snooze_task(ids[-1], time.time() + 86400)
        store.close()
        with mock.patch.object(api._hermes_sessions, 'archive_chat') as archive, TestClient(app) as client:
            response = client.patch('/groups/c', json={'status': 'done', 'task_ids': ids[:2]})
        assert response.status_code == 200, response.text
        archive.assert_not_called()
        assert response.json()['closed_task_ids'] == ids[:2]


def test_group_close_rejects_other_chat_without_partial_changes(tmp_path):
    api = fixtures._load_api_module()
    app = FastAPI()
    app.include_router(api.router)
    with mock.patch.object(api, 'plugin_data_directory', return_value=tmp_path):
        store = api.Store(str(tmp_path / 'wou.db'))
        ids = [store.upsert_task('c', 'A', 'T', f'Ask {i}?', f'Topic {i}', 2, 'm') for i in range(2)]
        foreign = store.upsert_task('other', 'A', 'Other', 'Foreign?', 'Topic', 2, 'm')
        store.close()
        with TestClient(app) as client:
            response = client.patch('/groups/c', json={'status': 'done', 'task_ids': [ids[0], foreign]})
        assert response.status_code == 400
        store = api.Store(str(tmp_path / 'wou.db'))
        assert all(store.get_task(tid)['status'] == 'open' for tid in ids + [foreign])
        store.close()
