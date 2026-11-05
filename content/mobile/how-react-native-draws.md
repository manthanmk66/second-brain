---
title: How React Native draws a screen
summary: You write React, but what shows up on the phone is real native views. JSI and the new renderer are how the two sides talk.
tags: [basics, architecture, expo]
order: 1
date: 2026-11-05
---

## It isn't a web page

A React Native app isn't a website inside a phone frame. When you write `<View>`, the phone creates a real native view, a `UIView` on iOS and an `android.view.View` on Android. That's why RN apps scroll and feel like apps, and also why some web habits (CSS grid, `div`, hover) don't carry over.

| You write | iOS gets | Android gets |
|---|---|---|
| `<View>` | `UIView` | `android.view.View` |
| `<ScrollView>` | `UIScrollView` | `ScrollView` |
| `<TextInput>` | `UITextField` | `EditText` |

## Two threads, one app

Your JavaScript (components, state, fetch calls) runs on the **JS thread**. Drawing and touch handling happen on the **UI thread**, which belongs to the phone. Keep the JS thread busy for too long and taps start feeling late, even though the UI thread itself is fine.

<figure class="dg"><svg viewBox="0 0 420 200" role="img" aria-label="React code talks to a C++ core through JSI, which drives the native views">
<g class="pop" style="animation-delay:0s"><rect class="box" x="10" y="40" width="110" height="64" rx="12"/><text x="65" y="68" text-anchor="middle" class="b">React code</text><text x="65" y="88" text-anchor="middle" class="m">JS thread</text></g>
<g class="pop" style="animation-delay:.15s"><rect class="box hot" x="155" y="40" width="110" height="64" rx="12"/><text x="210" y="68" text-anchor="middle" class="b">C++ core</text><text x="210" y="88" text-anchor="middle" class="m">via JSI</text></g>
<g class="pop" style="animation-delay:.3s"><rect class="box" x="300" y="40" width="110" height="64" rx="12"/><text x="355" y="68" text-anchor="middle" class="b">Native views</text><text x="355" y="88" text-anchor="middle" class="m">UI thread</text></g>
<path class="flow" d="M122 64 H153"/><path class="flow" style="animation-direction:reverse" d="M122 80 H153"/>
<path class="flow" d="M267 64 H298"/><path class="flow" style="animation-direction:reverse" d="M267 80 H298"/>
<rect class="box dashed" x="10" y="138" width="400" height="44" rx="10"/>
<text class="m" x="210" y="165" text-anchor="middle">Before 0.76: an async JSON bridge sat in the middle</text>
</svg><figcaption>The new architecture: JS calls into C++ directly through JSI, instead of posting JSON messages across a bridge.</figcaption></figure>

## The new architecture, in plain words

The old setup had a **bridge**: JS serialised every message to JSON, sent it across, and waited. It worked, but it was slow and always async. Since React Native 0.76 the new architecture is on by default, and it has a few named parts you'll hear about:

- **JSI** lets JavaScript hold direct references to C++ objects and call them, no JSON round-trip.
- **Fabric** is the new renderer. It can measure and draw on either thread, which helps with things like text that resizes as you type.
- **TurboModules** are native modules (camera, storage, haptics) that load only when you first use them, so startup is faster.

> [!tip] Start with Expo
> The React Native docs now point new projects at a framework, and Expo is the one they name. You get file-based routing, over-the-air updates and builds in the cloud, and you can still drop down to native code when you need to. Neev already runs on it.

## Smooth animations

Because animations have to update every frame, running them from the JS thread means any heavy work (parsing a big response, say) makes them stutter. **Reanimated** moves the animation logic onto the UI thread, so the motion stays smooth even when JS is busy.

```flashcards
Q: What does <View> turn into on iOS?
A: A real native UIView, not an HTML element.
Q: Which thread runs your React components?
A: The JS thread. Drawing and touch belong to the UI thread.
Q: What does JSI replace?
A: The old async JSON bridge. JS can now call C++ objects directly.
Q: Why use Reanimated for animations?
A: It runs animation logic on the UI thread, so busy JS doesn't make them stutter.
```

```quiz
? Taps feel laggy right after the app loads a big list from the API. What's the most likely reason?
- The UI thread is drawing too many views
+ The JS thread is busy processing the data
- Fabric is turned off
= Touch handlers run in JS. While JS is busy parsing or sorting, it can't respond to the tap yet.
```
