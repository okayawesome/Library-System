from library_system.library_card import LibraryCard


# --------------------------------------------------
# USER CLASS
# --------------------------------------------------

# The User class represents a person using
# the library system.
#
# Object Composition is used here.
#
# A User contains a LibraryCard.
#
# Whenever a new User is created, a LibraryCard
# is automatically created for that User.
#
# Therefore:
#
# The User can access LibraryCard functionality through:
#
# user.library_card


class User:

    def __init__(self, name):

        if not name.strip():
            raise ValueError(
                "User name cannot be empty."
            )

        self.name = name.strip()

        # Object Composition
        self.library_card = LibraryCard(self)
