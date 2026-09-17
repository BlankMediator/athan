# Location catalogue

Contains a compact adaptation of [GeoNames](https://www.geonames.org/) data,
licensed under [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/).
GeoNames provides the data without a guarantee of completeness or accuracy.

Sources: [cities500.zip, countryInfo.txt and admin1CodesASCII.txt](https://download.geonames.org/export/dump/).
The cities500 selection covers places with population over 500 and administrative
seats. Small settlements and some territories have no entries; online lookup and
manual coordinates remain available in Athan.

Adaptation: retains IDs, names, country codes, coordinates, IANA time zones and
alternate names; appends region names; removes obsolete country codes and entries
without a time zone or supported latitude; stores compact compressed JSON.
`countries.json` records the generation date, source hashes and actual counts.

Rebuild using `python scripts/build-location-catalogue.py` after downloading the
three source files into `.cache/geonames`. Then run the catalogue tests, including
coordinate and time zone validation, before shipping updated data.

The original Athan application's proprietary database is not included.
