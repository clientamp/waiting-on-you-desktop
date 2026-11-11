import sys
import threading
from pathlib import Path
from unittest import mock
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from tests_py import test_plugin as fixtures


def test_registration_uses_real_host_unload_callback(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_WOU_BACKGROUND", "1")
    mod = fixtures.PluginRegisterTest()._load_register()
    monkeypatch.setattr(mod, '_data_dir', lambda: tmp_path)
    from importlib import import_module
    settings = import_module(mod.__name__ + '.wou.settings')
    settings.save_settings(tmp_path, {'consented': True})
    callbacks = []
    ctx = fixtures.FakeCtx()
    ctx.on_unload = callbacks.append
    with mock.patch.object(mod, 'BackgroundRunner') as runner:
        mod.register(ctx)
        assert len(callbacks) == 1
        callbacks[0]()
        runner.return_value.stop.assert_called_once()


def test_model_hook_does_not_start_unconsented_runner(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_WOU_BACKGROUND", "1")
    mod = fixtures.PluginRegisterTest()._load_register()
    monkeypatch.setattr(mod, '_data_dir', lambda: tmp_path)
    with mock.patch.object(mod, 'BackgroundRunner') as runner:
        ctx = fixtures.FakeCtx()
        mod.register(ctx)
        ctx.hooks['post_llm_call'](session_id='local-test-chat')
        runner.assert_not_called()


def test_stopping_losing_runner_does_not_release_winner(tmp_path, monkeypatch):
    from wou import scanner
    monkeypatch.setattr(scanner, '_background_started', False)
    fake = SimpleNamespace(data_dir=tmp_path, should_run_background=lambda: False)
    runners = [scanner.BackgroundRunner(fake, interval_seconds=60) for _ in range(3)]
    try:
        runners[0].start()
        runners[1].start()
        runners[1].stop()
        runners[2].start()
        assert runners[0]._thread.is_alive()
        assert runners[1]._thread is None
        assert runners[2]._thread is None
    finally:
        for runner in runners:
            runner.stop()
