# Tavla

React Native (Expo) ile geliştirilmiş, yatay modda oynanan profesyonel mobil tavla (backgammon) oyunu. Yapay zeka rakibe karşı, gerçek tavla kurallarıyla oynanır.

## Özellikler

- **Tam tavla kuralları** — kırık taş (bar) zorunluluğu, çift zar (4 hamle), taş toplama (bear-off) ve vurma mekaniği eksiksiz uygulanır.
- **Yapay zeka rakip** — pip sayımı, blot/prime değerlendirmesi ve konum sezgileriyle hamle seçen sezgisel motor (kolay / orta / zor).
- **İki hamle yöntemi** — taşları sürükle-bırak ile ya da üzerine dokunarak otomatik oynama.
- **Akıcı arayüz** — taş kayma animasyonları, zar tepsisi, geçerli hamle vurguları, oyuncu panelleri ve sıra göstergesi.
- **Yatay (landscape) tasarım** — telefon ve tablet için tam ekran, oyuncu perspektifine göre düzenlenmiş tahta.
- **OTA güncelleme** — Expo Updates ile anlık sürüm dağıtımı.

## Teknoloji

| Katman | Kullanılan |
| --- | --- |
| Çerçeve | React Native 0.81 · Expo SDK 54 |
| Durum yönetimi | Zustand |
| Animasyon | React Native Animated · Reanimated |
| Görsel | expo-linear-gradient |

## Proje Yapısı

```
src/
├── store/
│   └── gameStore.js      # Zustand oyun durumu, hamle uygulama, AI turu yönetimi
├── components/
│   ├── Board.js          # Tahta, sürükle-bırak (PanResponder), animasyonlar
│   ├── Checker.js        # 3B gradyanlı taş bileşeni
│   └── Dice.js           # Animasyonlu zar bileşeni
├── screens/
│   ├── GameScreen.js     # Oyun ekranı, paneller, zar ve menü katmanları
│   └── MenuScreen.js     # Ana menü
├── utils/
│   ├── gameLogic.js      # Kural motoru: geçerli hamleler, bear-off, oyun sonu
│   ├── aiPlayer.js       # Yapay zeka hamle seçimi
│   └── diceUtils.js      # Zar atma
└── constants/
    └── theme.js          # Renkler, boyutlar, gradyanlar
```

## Kurulum

```bash
npm install
npm start
```

Ardından Expo Go ile QR kodu okutun veya bir emülatör başlatın:

```bash
npm run android
npm run ios
```

## Dağıtım

Anlık OTA güncelleme:

```bash
npx eas-cli update --branch preview --message "guncelleme notu"
```

Android APK derleme:

```bash
npx eas-cli build -p android --profile preview
```

## Lisans

Özel proje. Tüm hakları saklıdır.
