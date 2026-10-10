import { Faker, en } from '@faker-js/faker';

/**
 * Fake data for seeds, fixtures, and tests. NEVER real guests.
 * Every name carries the FAKE_MARKER so it is obvious on staging and in screenshots,
 * and emails use the reserved example.test domain.
 */
export const FAKE_MARKER = '(Fake)';
export const FAKE_EMAIL_DOMAIN = 'example.test';

export interface FakeGuest {
  firstName: string;
  lastName: string;
  email: string;
}

export interface FakeHousehold {
  label: string;
  guests: FakeGuest[];
}

export function makeFaker(seed = 20270522): Faker {
  const f = new Faker({ locale: [en] });
  f.seed(seed);
  return f;
}

export function fakeHouseholds(count: number, seed?: number): FakeHousehold[] {
  const f = makeFaker(seed);
  return Array.from({ length: count }, (_, h) => {
    const lastName = `${f.person.lastName()} ${FAKE_MARKER}`;
    const size = f.number.int({ min: 1, max: 4 });
    const guests = Array.from({ length: size }, (_, g) => {
      const firstName = f.person.firstName();
      return {
        firstName,
        lastName,
        email: `guest-${h}-${g}@${FAKE_EMAIL_DOMAIN}`,
      };
    });
    return { label: `Household ${h + 1} ${FAKE_MARKER}`, guests };
  });
}
