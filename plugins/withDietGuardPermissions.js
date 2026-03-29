const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withDietGuardPermissions(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest.queries = manifest.queries || [];

    manifest.queries.push(
      {
        package: [
          { $: { 'android:name': 'in.swiggy.android' } },
          { $: { 'android:name': 'com.application.zomato' } },
          { $: { 'android:name': 'com.Dominos' } },
          { $: { 'android:name': 'com.grofers.customerapp' } },
          { $: { 'android:name': 'com.zeptoconsumerapp' } }
        ]
      },
      {
        intent: [
          {
            action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
            category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }]
          }
        ]
      }
    );

    return config;
  });
};
