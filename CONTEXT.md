# Pedal Pay

Log your bike commutes in a tap, claim your bike allowance in ERPx in one click.

This file is the glossary and nothing else: each word the project uses for its
own concepts, defined in a sentence or two, with the words to avoid. No
implementation, no decisions, no code. A general programming term does not
belong here.

## Language

**Ride**:
A workday on which someone commuted to work by bike.
_Avoid_: bike day, trip

**Morning prompt**:
The question "Did you bike today?" asked when the work PC is signed in to.
_Avoid_: reminder, popup

**Reminder time**:
The time of day the morning prompt asks, 09:00 unless the user changes it.
_Avoid_: alarm, notification time

**Missed day**:
A workday the morning prompt went unanswered. It counts as no ride until
the user marks it.
_Avoid_: skipped day

**Km per ride**:
The distance claimed for one ride, the same every day for one user.
_Avoid_: distance, kilometres

**Rate per km**:
The euros the employer pays for one km biked: 0.36 until the fill bookmark
reads the real rate from the bike allowance lines in ERPx.
_Avoid_: tariff, price

**Allowance line**:
One bike allowance expense line in ERPx, of type FIETSVG, for one ride.
_Avoid_: expense, row

**Fill bookmark**:
The browser favourite that, clicked on the ERPx page, makes one month's
allowance lines match the logged rides.
_Avoid_: bookmarklet, script

**Allowed site**:
An ERPx site the user let the app share their rides with, asked once per site.
_Avoid_: trusted domain, whitelist

**Fill popup**:
The small window the fill bookmark shows inside ERPx while it adds and
removes allowance lines, with a progress bar.
_Avoid_: review panel, generator

**Streak**:
The number of days in a row with a ride, counting back from today. A weekend
or holiday counts when it is marked as a ride and is skipped when it is not;
the first workday without a ride ends it. Today only counts once answered.
_Avoid_: chain, run
