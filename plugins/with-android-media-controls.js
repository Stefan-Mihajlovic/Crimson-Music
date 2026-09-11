/* global __dirname */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '// Crimson Android media adapter v1';
const SOURCE_DIRECTORY = path.join(__dirname, 'crimson-android-media');

function replaceRequired(source, original, replacement, label) {
  if (!source.includes(original)) throw new Error(`Crimson Android media: upstream ${label} changed; review the Expo Audio adapter before building.`);
  return source.replace(original, replacement);
}

/** Extend Expo's one foreground playback service, not a second MediaSession/player. */
function patchAndroidMedia(projectRoot) {
  const projectPackage = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  const sourceModules = projectPackage.expo?.autolinking?.android?.buildFromSource || [];
  if (!sourceModules.some((pattern) => new RegExp(`^(?:${pattern})$`).test('expo-audio'))) {
    throw new Error('Crimson Android media requires expo.autolinking.android.buildFromSource to include expo-audio in package.json. Otherwise Expo uses its unmodified prebuilt audio module.');
  }
  const packagePath = require.resolve('expo-audio/package.json', { paths: [projectRoot] });
  const version = JSON.parse(fs.readFileSync(packagePath, 'utf8')).version;
  if (version !== '57.0.5') throw new Error(`Crimson Android media adapter supports expo-audio 57.0.5; review it before upgrading from ${version}.`);
  const sourceRoot = path.join(path.dirname(packagePath), 'android/src/main/java/expo/modules/audio');
  const changes = new Map();
  function patch(relative, transform) {
    const file = path.join(sourceRoot, relative);
    const source = fs.readFileSync(file, 'utf8');
    if (!source.includes(MARKER)) changes.set(file, `${MARKER}\n${transform(source)}`);
  }

  patch('AudioModule.kt', (source) => {
    source = replaceRequired(source, '    Name("ExpoAudio")', `    Name("ExpoAudio")
    Events("crimsonRemoteNext", "crimsonRemotePrevious", "crimsonRemoteLike")

    Function("configureCrimsonRemoteControls") { active: Boolean, canGoNext: Boolean, canGoPrevious: Boolean, liked: Boolean ->
      CrimsonRemoteCommands.configure(active, canGoNext, canGoPrevious, liked)
    }

    AsyncFunction("extractCrimsonArtworkPalette") Coroutine { source: String, cacheKey: String, allowNetwork: Boolean ->
      kotlinx.coroutines.withContext(Dispatchers.IO) {
        CrimsonArtworkPalette.extract(context.applicationContext, source, cacheKey, allowNetwork)
      }
    }`, 'module definition');
    source = replaceRequired(source, '    OnCreate {', `    OnCreate {
      CrimsonRemoteCommands.emit = { event -> sendEvent(event, emptyMap<String, Any>()) }`, 'module creation');
    return replaceRequired(source, '    OnDestroy {', `    OnDestroy {
      CrimsonRemoteCommands.disconnect()`, 'module destruction');
  });

  patch('service/MetadataInjectingPlayer.kt', (source) => {
    source = replaceRequired(source, 'import expo.modules.audio.Metadata', 'import expo.modules.audio.Metadata\nimport expo.modules.audio.CrimsonRemoteCommands', 'metadata import');
    source = replaceRequired(source, '  override fun getMediaMetadata(): MediaMetadata {', `  override fun getAvailableCommands(): Player.Commands {
    val state = CrimsonRemoteCommands.state
    return super.getAvailableCommands().buildUpon()
      .remove(Player.COMMAND_SEEK_TO_NEXT)
      .remove(Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM)
      .remove(Player.COMMAND_SEEK_TO_PREVIOUS)
      .remove(Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM)
      .addIf(Player.COMMAND_SEEK_TO_NEXT, state.canGoNext)
      .addIf(Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM, state.canGoNext)
      .addIf(Player.COMMAND_SEEK_TO_PREVIOUS, state.canGoPrevious)
      .addIf(Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM, state.canGoPrevious)
      .build()
  }

  override fun isCommandAvailable(command: Int): Boolean = availableCommands.contains(command)
  override fun seekToNext() = CrimsonRemoteCommands.dispatch(CrimsonRemoteCommands.ACTION_NEXT)
  override fun seekToNextMediaItem() = CrimsonRemoteCommands.dispatch(CrimsonRemoteCommands.ACTION_NEXT)
  override fun seekToPrevious() = CrimsonRemoteCommands.dispatch(CrimsonRemoteCommands.ACTION_PREVIOUS)
  override fun seekToPreviousMediaItem() = CrimsonRemoteCommands.dispatch(CrimsonRemoteCommands.ACTION_PREVIOUS)

  fun updateRemoteCommands() {
    if (Looper.myLooper() != applicationLooper) {
      handler.post { updateRemoteCommands() }
      return
    }
    val commands = availableCommands
    val events = Player.Events(FlagSet.Builder().add(Player.EVENT_AVAILABLE_COMMANDS_CHANGED).build())
    val currentListeners = synchronized(listeners) { listeners.keys.toList() }
    currentListeners.forEach { it.onAvailableCommandsChanged(commands) }
    currentListeners.forEach { it.onEvents(this, events) }
  }

  override fun getMediaMetadata(): MediaMetadata {`, 'metadata player');
    return replaceRequired(source, '    override fun onMediaMetadataChanged(mediaMetadata: MediaMetadata) {', `    override fun onAvailableCommandsChanged(availableCommands: Player.Commands) {
      listener.onAvailableCommandsChanged(this@MetadataInjectingPlayer.availableCommands)
    }

    override fun onMediaMetadataChanged(mediaMetadata: MediaMetadata) {`, 'metadata listener');
  });

  patch('service/AudioMediaSessionCallback.kt', (source) => {
    source = replaceRequired(source, 'import android.os.Bundle', 'import android.os.Bundle\nimport expo.modules.audio.CrimsonRemoteCommands\nimport com.google.common.util.concurrent.Futures', 'session imports');
    source = replaceRequired(source, `            // Remove track navigation commands
            .remove(Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM)
            .remove(Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM)
            .remove(Player.COMMAND_SEEK_TO_PREVIOUS)
            .remove(Player.COMMAND_SEEK_TO_NEXT)`, `            // The wrapper exposes only the queue directions currently available.
            .add(Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM)
            .add(Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM)
            .add(Player.COMMAND_SEEK_TO_PREVIOUS)
            .add(Player.COMMAND_SEEK_TO_NEXT)`, 'session queue permissions');
    source = replaceRequired(source, '            .add(SessionCommand(AudioControlsService.ACTION_SEEK_FORWARD, Bundle.EMPTY))', '            .add(SessionCommand(AudioControlsService.ACTION_SEEK_FORWARD, Bundle.EMPTY))\n            .add(SessionCommand(CrimsonRemoteCommands.ACTION_LIKE, Bundle.EMPTY))', 'session like permission');
    return replaceRequired(source, '    when (command.customAction) {', `    when (command.customAction) {
      CrimsonRemoteCommands.ACTION_LIKE -> {
        CrimsonRemoteCommands.dispatch(CrimsonRemoteCommands.ACTION_LIKE)
        return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
      }`, 'session custom command');
  });

  patch('service/AudioControlsService.kt', (source) => {
    source = replaceRequired(source, 'import expo.modules.audio.AudioPlayer', 'import expo.modules.audio.AudioPlayer\nimport expo.modules.audio.CrimsonRemoteCommands', 'service imports');
    source = replaceRequired(source, '  private lateinit var audioManager: AudioManager', `  private val crimsonCommandsChanged: () -> Unit = {
    sessionMetadataPlayer?.updateRemoteCommands()
    updateSessionCustomLayout(currentPlayer?.ref?.isPlaying ?: false)
    postOrStartForegroundNotification(startInForeground = false)
  }
  private lateinit var audioManager: AudioManager`, 'service state');
    source = replaceRequired(source, '    createNotificationChannelIfNeeded()', '    createNotificationChannelIfNeeded()\n    CrimsonRemoteCommands.addListener(crimsonCommandsChanged)', 'service creation');
    source = replaceRequired(source, '  override fun onDestroy() {', '  override fun onDestroy() {\n    CrimsonRemoteCommands.removeListener(crimsonCommandsChanged)', 'service destruction');
    source = replaceRequired(source, '      when (intent?.action) {', `      when (intent?.action) {
        CrimsonRemoteCommands.ACTION_NEXT -> CrimsonRemoteCommands.dispatch(CrimsonRemoteCommands.ACTION_NEXT)
        CrimsonRemoteCommands.ACTION_PREVIOUS -> CrimsonRemoteCommands.dispatch(CrimsonRemoteCommands.ACTION_PREVIOUS)
        CrimsonRemoteCommands.ACTION_LIKE -> CrimsonRemoteCommands.dispatch(CrimsonRemoteCommands.ACTION_LIKE)`, 'legacy notification intents');
    // Older Android reads the explicit notification actions; Android 13+ uses the session commands.
    source = replaceRequired(source, '      if (currentOptions?.showSeekBackward == true) {', `      if (CrimsonRemoteCommands.state.canGoPrevious) {
        builder.addAction(NotificationCompat.Action(
          androidx.media3.session.R.drawable.media3_icon_previous,
          "Previous", buildActionPendingIntent(CrimsonRemoteCommands.ACTION_PREVIOUS)
        ))
        compactViewIndices.add(currentIndex)
        currentIndex++
      } else if (!CrimsonRemoteCommands.state.active && currentOptions?.showSeekBackward == true) {`, 'legacy previous button');
    source = replaceRequired(source, '      if (currentOptions?.showSeekForward == true) {', `      if (CrimsonRemoteCommands.state.canGoNext) {
        builder.addAction(NotificationCompat.Action(
          androidx.media3.session.R.drawable.media3_icon_next,
          "Next", buildActionPendingIntent(CrimsonRemoteCommands.ACTION_NEXT)
        ))
        compactViewIndices.add(currentIndex)
      } else if (!CrimsonRemoteCommands.state.active && currentOptions?.showSeekForward == true) {`, 'legacy next button');
    source = replaceRequired(source, '      style.setShowActionsInCompactView(*compactViewIndices.toIntArray())', `      if (CrimsonRemoteCommands.state.active) {
        builder.addAction(NotificationCompat.Action(
          if (CrimsonRemoteCommands.state.liked) androidx.media3.session.R.drawable.media3_icon_heart_filled else androidx.media3.session.R.drawable.media3_icon_heart_unfilled,
          if (CrimsonRemoteCommands.state.liked) "Unlike" else "Like",
          buildActionPendingIntent(CrimsonRemoteCommands.ACTION_LIKE)
        ))
      }
      style.setShowActionsInCompactView(*compactViewIndices.toIntArray())`, 'legacy like button');
    source = replaceRequired(source, '    // Add seek backward button if enabled', `    if (CrimsonRemoteCommands.state.active) {
      val state = CrimsonRemoteCommands.state
      mediaButtons.add(CommandButton.Builder(CommandButton.ICON_PREVIOUS)
        .setDisplayName("Previous").setEnabled(state.canGoPrevious)
        .setPlayerCommand(Player.COMMAND_SEEK_TO_PREVIOUS).setSlots(CommandButton.SLOT_BACK).build())
      mediaButtons.add(CommandButton.Builder(if (isPlaying) CommandButton.ICON_PAUSE else CommandButton.ICON_PLAY)
        .setDisplayName(if (isPlaying) "Pause" else "Play").setEnabled(true)
        .setPlayerCommand(Player.COMMAND_PLAY_PAUSE).setSlots(CommandButton.SLOT_CENTRAL).build())
      mediaButtons.add(CommandButton.Builder(CommandButton.ICON_NEXT)
        .setDisplayName("Next").setEnabled(state.canGoNext)
        .setPlayerCommand(Player.COMMAND_SEEK_TO_NEXT).setSlots(CommandButton.SLOT_FORWARD).build())
      mediaButtons.add(CommandButton.Builder(if (state.liked) CommandButton.ICON_HEART_FILLED else CommandButton.ICON_HEART_UNFILLED)
        .setDisplayName(if (state.liked) "Unlike" else "Like").setEnabled(true)
        .setSessionCommand(SessionCommand(CrimsonRemoteCommands.ACTION_LIKE, Bundle.EMPTY))
        .setSlots(CommandButton.SLOT_BACK_SECONDARY).build())
      session.setCustomLayout(mediaButtons)
      session.setMediaButtonPreferences(mediaButtons)
      return
    }

    // Add seek backward button if enabled`, 'modern media buttons');
    return source;
  });

  // Validate all anchors before writing any dependency source. Canonical files live in Git.
  for (const file of ['CrimsonRemoteCommands.kt', 'CrimsonArtworkPalette.kt']) {
    changes.set(path.join(sourceRoot, file), fs.readFileSync(path.join(SOURCE_DIRECTORY, file), 'utf8'));
  }
  for (const [file, contents] of changes) fs.writeFileSync(file, contents);
}

module.exports = function withAndroidMediaControls(config) {
  return withDangerousMod(config, ['android', (mod) => {
    patchAndroidMedia(mod.modRequest.projectRoot);
    return mod;
  }]);
};
module.exports.patchAndroidMedia = patchAndroidMedia;
