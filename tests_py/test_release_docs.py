"""Release packaging/documentation checks; no installed plugin is modified."""
import io
import json
import re
import subprocess
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_release_versions_and_documented_install_commands():
    for manifest in ('plugin.yaml', 'satellite/plugin.yaml'):
        assert re.search(r'^version: 1\.0\.1$', (ROOT / manifest).read_text(), re.M)
    package = json.loads((ROOT / 'package.json').read_text())
    lock = json.loads((ROOT / 'package-lock.json').read_text())
    assert package['version'] == lock['version'] == lock['packages']['']['version'] == '1.0.1'
    readme = (ROOT / 'README.md').read_text()
    assert 'hermes plugins install clientamp/waiting-on-you-desktop --enable' in readme
    assert 'hermes plugins install waiting-on-you-desktop --enable' in readme
    assert 'daves-toolbox' not in readme
    assert 'Once this plugin is listed' in readme
    assert '<git-url>' not in readme
    assert re.findall(r'!\[[^\]]*\]\((assets/readme/[^)]+)\)', readme) == [
        'assets/readme/panel.png', 'assets/readme/nested.png',
        'assets/readme/next-up.png', 'assets/readme/settings.png', 'assets/readme/teach-priorities.png',
        'assets/readme/first-run.png',
    ]
    for image in re.findall(r'!\[[^\]]*\]\((assets/readme/[^)]+)\)', readme):
        assert (ROOT / image).is_file(), image


def test_release_git_archive_excludes_scratch_harness():
    attrs = (ROOT / '.gitattributes').read_text()
    assert 'scratch/' in attrs and 'export-ignore' in attrs
    out = subprocess.run(
        ['git', 'archive', '--format=tar', 'HEAD'],
        cwd=ROOT,
        capture_output=True,
        check=True,
    )
    with tarfile.open(fileobj=io.BytesIO(out.stdout), mode='r:') as tf:
        names = tf.getnames()
    assert not any(n.startswith('scratch/') for n in names), names[:20]


def test_changelog_describes_the_full_release():
    release = (ROOT / 'CHANGELOG.md').read_text().split('## 1.0.0', 1)[1].split('\n## ', 1)[0].lower()
    for phrase in ('hermes projects', 'tags', 'group', 'context', 'due dates', 'quiz',
                   'decision models', 'tag suggestions', 'privacy', 'retention'):
        assert phrase in release
