# Property is not a possession

A house, a farm, and an office are physical things the owner has, which makes them look like possessions. They get their own `property` table instead.

A possession's facts are one-time: what you paid, when you bought it, what you sold it for. A property's facts are periodic: rent per month, tax per year, tenant per lease. Nothing periodic applies to a bicycle, so folding property into `possession` puts a column on every bicycle row that is always null — and the count makes it worse, because there are hundreds of possessions and a handful of properties.

The same test rules the other way for purchase research: a thing you research, buy, use, and sell is **one** possession with a changing status, not a research record plus an ownership record. The fields do not diverge; only the status does.

## Consequences

An entry can name a possession or a property, so `entry` carries one nullable foreign key per target — `possession_id`, `property_id`, `contact_id` — rather than a generic `subject_type` + `subject_id` pair. Separate columns keep real foreign keys, which D1 enforces; a generic pair cannot be checked and would fail silently.

If `property` turns out to hold no periodic data and only a few rows, it does not earn a table and becomes prose in `entry`. That question is open — see [What a property record holds](https://github.com/shreshthmohan/self/issues/15).

The concept was called a *belonging* until #5 renamed it to *possession*.
