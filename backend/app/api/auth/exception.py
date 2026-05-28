class UsernameAlreadyExistsError(Exception):
    """ユーザー名重複時の例外"""

    pass


class EmailAlreadyExistsError(Exception):
    """メールアドレス重複時の例外"""

    pass
