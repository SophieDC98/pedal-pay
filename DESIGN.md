# Pedal Pay design

This file holds what Pedal Pay is for: its vision, its goals and what it
will not do. It never holds how the code is built, which belongs in
`docs/adr/`, and it never links a decision or names a file in the code. It
changes when the direction changes, not when a decision does, and it stays
under 150 lines.

## Vision

Log your bike commutes in a tap, claim your bike allowance in ERPx in one click.

## Goals

- Every workday morning, someone is asked with one tap whether they biked,
  so nobody has to remember a month of commutes.
- Claiming the month in ERPx takes one click on a bookmark, followed by a
  quick review of the days before anything is created.
- A colleague without technical knowledge can set it up alone, by following
  one page.

## Non-goals

- No use on a phone. Rides are logged on the work PC where ERPx is opened.
- No server and no accounts. Everything stays in the user's own browser.
- It never submits a claim in ERPx. The user reviews and submits it.
