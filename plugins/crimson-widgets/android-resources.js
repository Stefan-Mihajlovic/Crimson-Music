const fs = require('fs');
const path = require('path');

const ns = 'xmlns:android="http://schemas.android.com/apk/res/android"';
const size = 'android:layout_width="match_parent" android:layout_height="wrap_content"';
const white = 'android:textColor="#FFFFFFFF"';
function text(id, value, points = 12, extra = '') {
  return `<TextView android:id="@+id/crimson_${id}" ${size} ${white} android:text="${value}" android:textSize="${points}sp" android:maxLines="1" android:ellipsize="end" ${extra} />`;
}
function button(id, icon, label) {
  return `<ImageView android:id="@+id/crimson_${id}" android:layout_width="44dp" android:layout_height="44dp" android:padding="12dp" android:background="@drawable/crimson_widget_chip" android:src="@drawable/crimson_widget_${icon}" android:contentDescription="${label}" />`;
}
function shortcut(id, label) {
  return `<TextView android:id="@+id/crimson_${id}" android:layout_width="0dp" android:layout_weight="1" android:layout_height="40dp" android:layout_marginEnd="6dp" android:gravity="center_vertical" android:paddingHorizontal="10dp" android:background="@drawable/crimson_widget_chip" android:text="${label}" android:textColor="#FFF3EEFF" android:textSize="12sp" android:maxLines="1" android:ellipsize="end" />`;
}
function row(children, extra = '') { return `<LinearLayout ${size} android:orientation="horizontal" android:gravity="center_vertical" ${extra}>${children}</LinearLayout>`; }
function logo(points) {
  return `<ImageView android:layout_width="${points}dp" android:layout_height="${points}dp" android:layout_marginEnd="6dp" android:scaleType="fitCenter" android:importantForAccessibility="no" android:src="@drawable/crimson_widget_logo" />`;
}
function brand() {
  return row(`${logo(20)}<TextView android:id="@+id/crimson_brand" android:layout_width="0dp" android:layout_weight="1" android:layout_height="wrap_content" ${white} android:text="Crimson" android:textSize="12sp" android:textStyle="bold" /><TextView android:layout_width="wrap_content" android:layout_height="wrap_content" android:textColor="#80FFFFFF" android:text="Open to play" android:textSize="10sp" />`);
}
function artwork(points) {
  return `<ImageView android:id="@+id/crimson_artwork" android:layout_width="${points}dp" android:layout_height="${points}dp" android:layout_marginEnd="12dp" android:scaleType="centerCrop" android:importantForAccessibility="no" android:src="@drawable/crimson_widget_note" />`;
}
function layout(widgetSize) {
  const small = widgetSize === 'small';
  const large = widgetSize === 'large';
  let contents = small ? `${artwork(46)}<TextView android:layout_width="1dp" android:layout_height="0dp" android:layout_weight="1" android:importantForAccessibility="no" />${text('title', 'Your music, ready', 15, 'android:textStyle="bold" android:layout_marginTop="6dp"')}${text('artist', 'Open Crimson to start listening', 11, 'android:alpha="0.7" android:layout_marginTop="4dp"')}${row(`${logo(14)}${text('hint', 'Open and resume', 10)}`, 'android:layout_marginTop="6dp"')}`
    : `${brand()}${row(`${artwork(large ? 60 : 48)}<LinearLayout android:layout_width="0dp" android:layout_weight="1" android:layout_height="wrap_content" android:orientation="vertical">${text('title', 'Your music, ready', 16, 'android:textStyle="bold"')}${text('artist', 'Open Crimson to start listening', 12, 'android:alpha="0.7" android:layout_marginTop="4dp"')}</LinearLayout>${button('play', 'play', 'Open Crimson and resume')}`, 'android:layout_marginTop="8dp"')}`;
  if (large) contents += row(`${button('previous', 'previous', 'Open Crimson and play previous')}<TextView android:id="@+id/crimson_up_next" android:layout_width="0dp" android:layout_weight="1" android:layout_height="wrap_content" android:paddingHorizontal="10dp" android:textColor="#BFFFFFFF" android:textSize="11sp" android:maxLines="1" android:ellipsize="end" />${button('next', 'next', 'Open Crimson and play next')}`, 'android:layout_marginTop="8dp"');
  if (!small) contents += row(`${shortcut('favorites', 'Favorites')}${shortcut('daily', 'Daily Mix')}${large ? '' : button('next', 'next', 'Open Crimson and play next')}`, 'android:layout_marginTop="8dp"');
  if (large) contents += `${row(`${shortcut('weekly', 'Weekly Mix')}${shortcut('monthly', 'Monthly Mix')}`, 'android:layout_marginTop="8dp"')}${row(`${shortcut('local', 'Local Music')}${shortcut('history', 'Recently played')}`, 'android:layout_marginTop="8dp"')}`;
  return `<?xml version="1.0" encoding="utf-8"?><LinearLayout ${ns} android:id="@+id/crimson_root" android:layout_width="match_parent" android:layout_height="match_parent" android:padding="12dp" android:orientation="vertical" android:background="@drawable/crimson_widget_background">${contents}</LinearLayout>`;
}

function writeAndroidResources(directory) {
  const write = (relative, content) => { const file = path.join(directory, relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };
  for (const [name, width, height, columns, rows] of [['small', 140, 144, 2, 2], ['medium', 250, 152, 4, 2], ['large', 250, 312, 4, 4]]) {
    write(`layout/crimson_widget_${name}.xml`, layout(name));
    write(`xml/crimson_widget_${name}_info.xml`, `<?xml version="1.0" encoding="utf-8"?><appwidget-provider ${ns} android:minWidth="${width}dp" android:minHeight="${height}dp" android:minResizeWidth="${width}dp" android:minResizeHeight="${height}dp" android:targetCellWidth="${columns}" android:targetCellHeight="${rows}" android:initialLayout="@layout/crimson_widget_${name}" android:previewLayout="@layout/crimson_widget_${name}" android:description="@string/crimson_widget_description" android:resizeMode="horizontal|vertical" android:updatePeriodMillis="0" android:widgetCategory="home_screen" />`);
  }
  write('values/crimson_widgets.xml', '<resources><string name="crimson_widget_small">Crimson · Small</string><string name="crimson_widget_medium">Crimson · Medium</string><string name="crimson_widget_large">Crimson · Large</string><string name="crimson_widget_description">Resume your music and open your Favorites, mixes, and local music.</string></resources>');
  write('drawable/crimson_widget_background.xml', `<shape ${ns} android:shape="rectangle"><corners android:radius="24dp"/><gradient android:startColor="#FF211B29" android:endColor="#FF0E0D13" android:angle="315"/></shape>`);
  write('drawable/crimson_widget_chip.xml', `<shape ${ns} android:shape="rectangle"><corners android:radius="12dp"/><solid android:color="#19FFFFFF"/></shape>`);
  for (const [name, data] of Object.entries({
    play: 'M8,5v14l11,-7z', pause: 'M6,5h4v14H6zM14,5h4v14h-4z',
    next: 'M6,5v14l10,-7zM16,5h3v14h-3z', previous: 'M18,5v14L8,12zM5,5h3v14H5z',
    note: 'M12,3v10.55A4,4 0,1 0,14 17V7h5V3z',
  })) write(`drawable/crimson_widget_${name}.xml`, `<vector ${ns} android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24"><path android:fillColor="#FF965CFF" android:pathData="${data}"/></vector>`);
}
module.exports = { layout, writeAndroidResources };
