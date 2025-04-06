export class User {
  static #autoincrementId = 0;
  id: number;
  name: string;

  constructor(name: string) {
    this.id = User.#autoincrementId++;
    this.name = name;
  }
}
