import { User } from "./user.ts";

export class Data {
  static #isInternalConstructing = false;
  static shared = Data.#create();

  #userMap = new Map<number, User>();

  private constructor() {
    if (!Data.#isInternalConstructing) {
      throw new TypeError("Test is not constructable");
    }
    Data.#isInternalConstructing = false;

    this.#addSampleUsers();
  }

  static #create() {
    Data.#isInternalConstructing = true;
    return new Data();
  }

  #addSampleUsers() {
    const user1 = new User("Alice");
    const user2 = new User("Bob");

    this.#userMap.set(user1.id, user1);
    this.#userMap.set(user2.id, user2);
  }

  public get users(): User[] {
    return this.#userMap.values().toArray();
  }

  getUser(id: number) {
    return this.#userMap.get(id);
  }

  createUser(name: string) {
    const user = new User(name);
    this.#userMap.set(user.id, user);

    return user;
  }

  updateUser(id: number, data: Partial<User>) {
    const user = this.getUser(id);
    if (!user) return undefined;

    this.#userMap.set(id, { ...user, ...data });

    return this.getUser(id);
  }

  deleteUser(id: number) {
    const user = this.getUser(id);
    this.#userMap.delete(id);

    return user;
  }
}
