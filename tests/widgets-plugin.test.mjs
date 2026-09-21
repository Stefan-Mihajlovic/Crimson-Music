import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const xcode = require('xcode');
const plist = require('@expo/plist').default;
const { installIOSExtension, installAndroidSources, patchMainApplication } = require('../plugins/with-crimson-widgets');

function bareProject() {
  const project = xcode.project('fixture.pbxproj');
  project.hash = { project: { rootObject: 'PROJECT', objects: {
    PBXProject: { PROJECT: { isa: 'PBXProject', mainGroup: 'MAIN', attributes: {}, targets: [{ value: 'APP', comment: 'App' }] } },
    PBXNativeTarget: { APP: { isa: 'PBXNativeTarget', name: 'App', buildConfigurationList: 'APP_CONFIGS', buildPhases: [], dependencies: [] }, APP_comment: 'App' },
    PBXGroup: { MAIN: { isa: 'PBXGroup', children: [], sourceTree: '"<group>"' }, MAIN_comment: 'Main', PRODUCTS: { isa: 'PBXGroup', name: 'Products', children: [], sourceTree: '"<group>"' }, PRODUCTS_comment: 'Products' },
    PBXFileReference: {}, PBXBuildFile: {},
    XCConfigurationList: { APP_CONFIGS: { isa: 'XCConfigurationList', buildConfigurations: [{ value: 'APP_DEBUG' }, { value: 'APP_RELEASE' }] } },
    XCBuildConfiguration: {
      APP_DEBUG: { isa: 'XCBuildConfiguration', name: 'Debug', buildSettings: { DEVELOPMENT_TEAM: '"TEAM123456"', CURRENT_PROJECT_VERSION: 17, MARKETING_VERSION: '2.3.4', IPHONEOS_DEPLOYMENT_TARGET: '16.4' } },
      APP_RELEASE: { isa: 'XCBuildConfiguration', name: 'Release', buildSettings: { DEVELOPMENT_TEAM: '"TEAM123456"', CURRENT_PROJECT_VERSION: 17, MARKETING_VERSION: '2.3.4', IPHONEOS_DEPLOYMENT_TARGET: '16.4' } },
    },
  } } };
  return project;
}

test('iOS widget generation is idempotent, embedded, signed with its app, and uses resolvable source paths', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'crimson-widget-test-'));
  try {
    const project = bareProject();
    const options = { bundleIdentifier: 'org.example.crimson', appGroup: 'group.org.example.crimson' };
    const first = installIOSExtension(project, directory, options);
    const second = installIOSExtension(project, directory, options);
    assert.equal(first, second);
    const objects = project.hash.project.objects;
    assert.equal(Object.values(objects.PBXNativeTarget).filter((item) => item.isa).length, 2);
    assert.equal(objects.PBXNativeTarget.APP.dependencies.length, 1);
    assert.equal(objects.PBXProject.PROJECT.attributes.TargetAttributes.APP.SystemCapabilities['com.apple.ApplicationGroups.iOS'].enabled, 1);
    assert.equal(objects.PBXProject.PROJECT.attributes.TargetAttributes[first].SystemCapabilities['com.apple.ApplicationGroups.iOS'].enabled, 1);
    const embed = Object.values(objects.PBXCopyFilesBuildPhase).find((item) => item.isa);
    assert.equal(Number(embed.dstSubfolderSpec), 13);
    assert.equal(embed.files.length, 1);
    assert.equal(project.pbxGroupByName('CrimsonWidgets').path, '.');
    const settings = objects.XCConfigurationList[objects.PBXNativeTarget[first].buildConfigurationList].buildConfigurations
      .map((reference) => objects.XCBuildConfiguration[reference.value].buildSettings);
    for (const setting of settings) {
      assert.equal(setting.DEVELOPMENT_TEAM, 'TEAM123456');
      assert.equal(setting.CURRENT_PROJECT_VERSION, 17);
      assert.equal(setting.MARKETING_VERSION, '2.3.4');
      assert.equal(setting.PRODUCT_BUNDLE_IDENTIFIER, 'org.example.crimson.widgets');
      assert.equal(setting.APPLICATION_EXTENSION_API_ONLY, 'YES');
      assert.ok(fs.existsSync(path.join(directory, setting.INFOPLIST_FILE)));
    }
    const entitlements = plist.parse(fs.readFileSync(path.join(directory, 'CrimsonWidgets/CrimsonWidgets.entitlements'), 'utf8'));
    assert.deepEqual(entitlements['com.apple.security.application-groups'], [options.appGroup]);
    const swift = fs.readFileSync(path.join(directory, 'CrimsonWidgets/CrimsonWidget.swift'), 'utf8');
    assert.ok(swift.includes('group.org.example.crimson'));
    assert.ok(!swift.includes('__APP_GROUP__'));
    assert.ok(swift.includes('Image("crimson-logo")'));
    assert.ok(!swift.includes('Image(systemName: "waveform")'));
    assert.ok(!/"(?:CRIMSON|OPEN TO PLAY|YOUR MUSIC|OPEN & RESUME)"/.test(swift));
    assert.deepEqual(fs.readFileSync(path.join(directory, 'CrimsonWidgets/crimson-logo.png')), fs.readFileSync(new URL('../assets/images/icon.png', import.meta.url)));
    const resources = Object.values(objects.PBXResourcesBuildPhase).filter((item) => item.isa).flatMap((item) => item.files);
    assert.equal(resources.filter((item) => item.comment.includes('crimson-logo')).length, 1);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('Android generation registers one native bridge and emits all three usable widget layouts', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'crimson-widget-test-'));
  try {
    installAndroidSources(directory, 'org.example.crimson');
    const application = 'PackageList(this).packages.apply {\n}';
    const patched = patchMainApplication(application, 'org.example.crimson');
    assert.equal(patchMainApplication(patched, 'org.example.crimson'), patched);
    const provider = fs.readFileSync(path.join(directory, 'app/src/main/java/org/example/crimson/widgets/CrimsonWidgetProvider.kt'), 'utf8');
    assert.ok(!provider.includes('__PACKAGE__'));
    assert.match(provider, /PendingIntent\.getActivity/);
    assert.match(provider, /FLAG_IMMUTABLE/);
    for (const size of ['small', 'medium', 'large']) {
      const layout = fs.readFileSync(path.join(directory, `app/src/main/res/layout/crimson_widget_${size}.xml`), 'utf8');
      assert.match(layout, /crimson_artwork/);
      assert.match(layout, /crimson_title/);
      assert.match(layout, /crimson_artist/);
      assert.match(layout, /@drawable\/crimson_widget_logo/);
      assert.ok(!/CRIMSON|OPEN TO PLAY|OPEN &amp; RESUME/.test(layout));
      if (size !== 'small') assert.match(layout, /crimson_play/);
      if (size === 'large') for (const id of ['favorites', 'daily', 'weekly', 'monthly', 'local', 'history']) assert.ok(layout.includes(`crimson_${id}`));
      const info = fs.readFileSync(path.join(directory, `app/src/main/res/xml/crimson_widget_${size}_info.xml`), 'utf8');
      assert.match(info, /updatePeriodMillis="0"/);
      assert.ok(info.includes(`@layout/crimson_widget_${size}`));
    }
    assert.deepEqual(fs.readFileSync(path.join(directory, 'app/src/main/res/drawable-nodpi/crimson_widget_logo.png')), fs.readFileSync(new URL('../assets/images/icon.png', import.meta.url)));
    assert.match(fs.readFileSync(path.join(directory, 'app/src/main/res/drawable/crimson_widget_play.xml'), 'utf8'), /#FF965CFF/);
    assert.throws(() => patchMainApplication('unsupported Java application', 'org.example.crimson'), /registration changed/);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
