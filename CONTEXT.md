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

**Missed day**:
A workday the morning prompt went unanswered. It counts as no ride until
the user marks it.
_Avoid_: skipped day

**Km per ride**:
The distance claimed for one ride, the same every day for one user.
_Avoid_: distance, kilometres

**Allowance line**:
One bike allowance expense line in ERPx, of type FIETSVG, for one ride.
_Avoid_: expense, row

**Fill bookmark**:
The browser favourite that, clicked on the ERPx page, creates allowance
lines from the logged rides.
_Avoid_: bookmarklet, script

**Review panel**:
The calendar the fill bookmark shows inside ERPx, where the user checks the
rides before allowance lines are created.
_Avoid_: generator, popup

**Streak**:
The number of workdays in a row with a ride. Weekends, public holidays and
missed days do not break it.
_Avoid_: chain, run
