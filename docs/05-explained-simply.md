# Explained simply

A short version of [docs/04](04-countryside-and-fire.md) for people who don't know the project.
Every figure comes from docs/04 and [docs/01](01-verified-facts.md).

Spanish original: [docs/es/05-explicado-facil.md](es/05-explicado-facil.md).

## What is the problem?

In Yucatán, people burn the brush to plant. Each mayor has to grant the burning permits and, when
the season ends, hand SEDER a report on how it went (the law requires it). But mayors have no
data. They don't know which parts of their municipality burn, or in which weeks.

What gets recorded looks nothing like what happens: in 2023 there were 187 burning permits and
the satellite saw 8,757 hot spots, one permit for every 47 hot spots. And in the zones that burn
every year, only 1 in 4 fires falls inside the official window for its zone. The window says when
burning is allowed, not when it is burned, so it is no use for knowing when to watch.

## Why does it matter?

When you don't know where or when burning happens, you can't prevent fires: you send your people
out blind. And when a fire gets away, the people who lose the most are the ones who work the land.
In Oxkutzcab, a brush burn that got out of control destroyed 15 hectares of Persian lime. In 2024,
more than 20 thousand hectares burned in Yucatán. These are people with no cushion: 8 in 10
hectares depend on rain, and only 2 in 100 production units got credit.

## How do we solve it?

We use the fire detections from two NASA satellites, MODIS and VIIRS, and put them on a single map
by municipality. You pick your municipality and see:

1. **Whether your season is going worse or better than normal**, week by week. To do this we
   joined 25 years of MODIS and VIIRS into a single comparable series (the two satellites see
   between 3 and 5 times a different amount of fire, and without calibrating them there is no
   long history).
2. **Where it burns almost every year.** That is where you go before the season to talk to the
   owners, check firebreaks and grant permits.
3. **In which weeks each zone burns.** In the zones that burn every year, their 4 strongest weeks
   capture 49 % of the next year's fire; the official window captures 23 %. That is double. This
   tells you when to watch each zone.
4. **Where fire has already gotten out of control before** (fires lasting 5 days or more). That is
   where you put the heaviest surveillance.

Points 2, 3 and 4 use 14 years of VIIRS (2012–2025), because MODIS doesn't see small fires.

At the end of the season, the same page gives you the summary ready for the report the law asks
for.

**What it does not do:** it does not predict wildfires, it does not warn in real time (it arrives
hours after the satellite passes) and it does not identify plots or people.

## Why does it help?

Because the law already asks the municipality to prevent and report, and today it does so without
data. We don't ask it to do anything new: we give it the data for what it already has to do.

## The project in one line

K'áak' tells each municipality in Yucatán where and in which weeks its territory burns, using NASA
satellite data, so it can prevent wildfires in the right place and at the right time.

## What the jury expects to hear (4 lines)

> In Yucatán, each municipality authorizes agricultural burns and must evaluate its season, but it
> does so without data: in 2023 there was one permit for every 47 hot spots seen by satellite.
> K'áak' joins 25 years of NASA MODIS and VIIRS detections into a single comparable series, so
> each municipality knows whether its season is going worse or better than normal, and with 14
> years of VIIRS it shows where burning happens year after year, in which weeks, and where fire
> has already escaped. In the zones that burn every year, those weeks capture half of the next
> year's fire, double the official window. It does not predict wildfires: it turns each
> municipality's past into a prevention plan.
