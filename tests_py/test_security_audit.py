"""Audit contracts: documentation, public home resolver and fail-closed auth seam."""
import importlib
import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
ROOT = Path(__file__).resolve().parent.parent


def test_default_home_uses_public_root_helper(tmp_path, monkeypatch):
    from wou import paths
    monkeypatch.setitem(sys.modules, 'hermes_constants', SimpleNamespace(get_default_hermes_root=lambda: tmp_path))
    assert paths._default_hermes_home() == tmp_path


def test_missing_token_route_api_disables_satellites(monkeypatch):
    auth = importlib.import_module('wou.satellite_auth')
    monkeypatch.setattr(auth, '_token_route_api', lambda: None)
    monkeypatch.setattr(auth, '_provider_registered', False)
    monkeypatch.setattr(auth, '_registration_reason', '')
    assert auth.ensure_registered(lambda: 'unused.db') == (False, 'token_auth seam unavailable')
    assert auth.WaitingOnYouSatelliteProvider(lambda: 'unused.db').verify_token(token='wousat_invalid') is None
    assert auth.registration_state() == (False, 'token_auth seam unavailable')


def test_privacy_discloses_all_outbound_paths_and_http_risk():
    readme = (ROOT / 'README.md').read_text()
    for label in ('Classifier:', 'Rename with AI:', 'Suggest tags:', 'Priority evaluation:', 'Optional decision provider:', 'Satellite → hub:'):
        assert label in readme
    for host in ('api.typesafe.ai', 'api.cloudflare.com', 'api.perplexity.ai', 'api.openai.com'):
        assert host in readme
    assert 'Nothing else from your machine is sent' not in readme
    assert 'satellite token and chat excerpts unencrypted on the LAN' in readme
    assert 'chat excerpts unencrypted' in (ROOT / 'src/ui/strings.ts').read_text()
    assert 'CSRF' in (ROOT / 'SECURITY.md').read_text()


def test_readme_collect_example_matches_loader(tmp_path):
    import json
    import re

    from wou.collect import Config

    readme = (ROOT / 'README.md').read_text()
    blocks = re.findall(r'```json\n(.*?)\n```', readme, re.S)
    sample = next(b for b in blocks if '"collect"' in b)
    data = json.loads(sample)
    from wou.config import load_config
    from wou.scanner import Scanner
    (tmp_path / 'config.json').write_text(sample)
    loaded = load_config(tmp_path)
    cfg = Scanner(tmp_path)._collect_cfg(loaded)
    assert cfg.agent_names == data['collect']['agent_names']
    assert cfg.skip_title_prefixes == data['collect']['skip_title_prefixes']
    assert cfg.local_profiles == data['collect']['local_profiles']
    assert cfg.remote_hosts == data['collect']['remote_hosts']
    assert 'action_handlers' in data
    assert 'action_handlers' not in data['collect']
    from wou.config import normalized_action_handlers
    assert normalized_action_handlers(loaded) == data['action_handlers']
